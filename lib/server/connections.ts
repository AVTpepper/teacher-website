import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { FREE_MONTHLY_CONNECTION_REQUEST_LIMIT } from "@/lib/network/constants";
import type {
  ConnectionListItem,
  ConnectionQuotaSummary,
  ConnectionRecord,
  ConnectionRelationshipState,
  ConnectionRequestReason,
  ConnectionStatus,
  ConnectionUserSummary,
} from "@/lib/network/types";
import {
  buildParticipantKey,
  canonicalParticipantIds,
  evaluateConnectionQuota,
  getUtcMonthKey,
  normalizeTier,
  toRelationshipState,
  validateIntroMessage,
} from "@/lib/network/utils";
import { getFirebaseAdminDb } from "@/lib/server/firebaseAdmin";

const PENDING = "pending" satisfies ConnectionStatus;
const ACCEPTED = "accepted" satisfies ConnectionStatus;
const DECLINED = "declined" satisfies ConnectionStatus;
const CANCELED = "canceled" satisfies ConnectionStatus;
const REMOVED = "removed" satisfies ConnectionStatus;

type ConnectionNotificationType = "connection-request" | "connection-accepted";

export class ConnectionServiceError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "ConnectionServiceError";
    this.code = code;
    this.status = status;
  }
}

interface SendRequestInput {
  requesterId: string;
  recipientId: string;
  reason?: ConnectionRequestReason;
  introMessage?: string;
}

interface MutationResult {
  participantKey: string;
  state: ConnectionRelationshipState;
  status: ConnectionStatus;
  requesterId: string;
  recipientId: string;
}

function asIso(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const cast = value as { toDate: () => Date };
    return cast.toDate().toISOString();
  }
  return undefined;
}

function connectionRef(participantKey: string) {
  return getFirebaseAdminDb().collection("connections").doc(participantKey);
}

function quotaRef(uid: string, periodKey: string) {
  return getFirebaseAdminDb().doc(`users/${uid}/connectionRequestUsage/${periodKey}`);
}

async function createConnectionNotification(input: {
  recipientId: string;
  type: ConnectionNotificationType;
  actorId: string;
  actorName: string;
  actorPhotoURL: string | null;
  message: string;
  linkURL: string;
}): Promise<void> {
  if (input.actorId === input.recipientId) return;

  await getFirebaseAdminDb().collection(`notifications/${input.recipientId}/items`).add({
    recipientId: input.recipientId,
    type: input.type,
    actorId: input.actorId,
    actorName: input.actorName,
    actorPhotoURL: input.actorPhotoURL,
    message: input.message,
    linkURL: input.linkURL,
    read: false,
    dismissed: false,
    createdAt: FieldValue.serverTimestamp(),
  });
}

function parseConnection(docId: string, data: Record<string, unknown>): ConnectionRecord {
  return {
    id: docId,
    participantKey: String(data.participantKey ?? docId),
    participantIds: (Array.isArray(data.participantIds)
      ? data.participantIds
      : []) as [string, string],
    requesterId: String(data.requesterId ?? ""),
    recipientId: String(data.recipientId ?? ""),
    status: String(data.status ?? "") as ConnectionStatus,
    reason: typeof data.reason === "string" ? (data.reason as ConnectionRequestReason) : undefined,
    introMessage: typeof data.introMessage === "string" ? data.introMessage : undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    acceptedAt: data.acceptedAt,
    declinedAt: data.declinedAt,
    canceledAt: data.canceledAt,
    removedAt: data.removedAt,
  };
}

function toItem(record: ConnectionRecord, otherUser: ConnectionUserSummary | null): ConnectionListItem {
  return {
    participantKey: record.participantKey,
    status: record.status,
    requesterId: record.requesterId,
    recipientId: record.recipientId,
    reason: record.reason,
    introMessage: record.introMessage,
    updatedAt: asIso(record.updatedAt),
    createdAt: asIso(record.createdAt),
    acceptedAt: asIso(record.acceptedAt),
    declinedAt: asIso(record.declinedAt),
    canceledAt: asIso(record.canceledAt),
    removedAt: asIso(record.removedAt),
    otherUser,
  };
}

function toSummary(data: Record<string, unknown> | null, uid: string): ConnectionUserSummary | null {
  if (!data) return null;
  return {
    uid,
    displayName: typeof data.displayName === "string" ? data.displayName : "Deleted account",
    photoURL: typeof data.photoURL === "string" ? data.photoURL : null,
    professionalHeadline:
      typeof data.professionalHeadline === "string" ? data.professionalHeadline : undefined,
    professionalRole:
      typeof data.professionalRole === "string" ? data.professionalRole : undefined,
    country: typeof data.country === "string" ? data.country : undefined,
    city: typeof data.city === "string" ? data.city : undefined,
  };
}

async function getTier(uid: string): Promise<"free" | "plus"> {
  const profileSnap = await getFirebaseAdminDb().collection("users").doc(uid).get();
  const data = profileSnap.exists ? (profileSnap.data() as Record<string, unknown>) : null;
  return normalizeTier(data?.tier);
}

export async function getConnectionQuota(uid: string): Promise<ConnectionQuotaSummary> {
  const tier = await getTier(uid);
  const periodKey = getUtcMonthKey();

  if (tier === "plus") {
    const summary = evaluateConnectionQuota({ used: 0, isUnlimited: true });
    return {
      periodKey,
      isUnlimited: true,
      limit: summary.limit,
      used: summary.used,
      remaining: summary.remaining,
      canSend: summary.canSend,
    };
  }

  const quotaSnap = await quotaRef(uid, periodKey).get();
  const used = quotaSnap.exists ? Number(quotaSnap.data()?.count ?? 0) : 0;
  const summary = evaluateConnectionQuota({
    used,
    isUnlimited: false,
    limit: FREE_MONTHLY_CONNECTION_REQUEST_LIMIT,
  });

  return {
    periodKey,
    isUnlimited: false,
    limit: summary.limit,
    used: summary.used,
    remaining: summary.remaining,
    canSend: summary.canSend,
  };
}

async function hydrateOtherUsers(
  records: ConnectionRecord[],
  currentUid: string,
): Promise<Map<string, ConnectionUserSummary | null>> {
  const db = getFirebaseAdminDb();
  const otherUserIds = Array.from(
    new Set(
      records
        .map((record) => record.participantIds.find((uid) => uid !== currentUid) ?? "")
        .filter(Boolean),
    ),
  );

  if (otherUserIds.length === 0) return new Map();

  const refs = otherUserIds.map((uid) => db.collection("users").doc(uid));
  const snapshots = await db.getAll(...refs);

  const byUid = new Map<string, ConnectionUserSummary | null>();
  snapshots.forEach((snap) => {
    const data = snap.exists ? (snap.data() as Record<string, unknown>) : null;
    byUid.set(snap.id, toSummary(data, snap.id));
  });

  return byUid;
}

export async function getConnectionStatusForPair(
  currentUid: string,
  otherUid: string,
): Promise<{ participantKey: string; status: ConnectionRelationshipState }> {
  const participantKey = buildParticipantKey(currentUid, otherUid);
  const snap = await connectionRef(participantKey).get();

  if (!snap.exists) {
    return { participantKey, status: "none" };
  }

  const record = parseConnection(snap.id, snap.data() as Record<string, unknown>);
  return {
    participantKey,
    status: toRelationshipState(record, currentUid),
  };
}

export async function getConnectionStatuses(
  currentUid: string,
  targetUids: string[],
): Promise<Record<string, { participantKey: string; status: ConnectionRelationshipState }>> {
  const unique = Array.from(new Set(targetUids.map((id) => id.trim()).filter(Boolean))).filter(
    (id) => id !== currentUid,
  );

  if (unique.length === 0) return {};

  const db = getFirebaseAdminDb();
  const keyByUid = new Map<string, string>();
  unique.forEach((uid) => {
    keyByUid.set(uid, buildParticipantKey(currentUid, uid));
  });

  const refs = Array.from(keyByUid.values()).map((key) => db.collection("connections").doc(key));
  const snapshots = await db.getAll(...refs);

  const result: Record<string, { participantKey: string; status: ConnectionRelationshipState }> = {};

  unique.forEach((uid) => {
    result[uid] = {
      participantKey: keyByUid.get(uid) ?? "",
      status: "none",
    };
  });

  snapshots.forEach((snap) => {
    if (!snap.exists) return;
    const record = parseConnection(snap.id, snap.data() as Record<string, unknown>);
    const otherUid = record.participantIds.find((uid) => uid !== currentUid);
    if (!otherUid) return;
    result[otherUid] = {
      participantKey: record.participantKey,
      status: toRelationshipState(record, currentUid),
    };
  });

  return result;
}

export async function sendConnectionRequest(input: SendRequestInput): Promise<MutationResult> {
  const requesterId = input.requesterId.trim();
  const recipientId = input.recipientId.trim();

  if (!requesterId) {
    throw new ConnectionServiceError("AUTH_REQUIRED", "Authentication required.", 401);
  }
  if (!recipientId) {
    throw new ConnectionServiceError("USER_NOT_FOUND", "User not found.", 404);
  }
  if (requesterId === recipientId) {
    throw new ConnectionServiceError("SELF_REQUEST", "Cannot connect to yourself.", 400);
  }

  const participantIds = canonicalParticipantIds(requesterId, recipientId);
  const participantKey = buildParticipantKey(requesterId, recipientId);
  const db = getFirebaseAdminDb();

  const requesterRef = db.collection("users").doc(requesterId);
  const recipientRef = db.collection("users").doc(recipientId);
  const connRef = connectionRef(participantKey);

  const periodKey = getUtcMonthKey();
  const usageRef = quotaRef(requesterId, periodKey);

  const introCheck = validateIntroMessage(input.introMessage);
  if (introCheck.error) {
    throw new ConnectionServiceError("INVALID_INTRO_MESSAGE", introCheck.error, 400);
  }

  const mutation = await db.runTransaction(async (transaction) => {
    const [requesterSnap, recipientSnap, connSnap] = await Promise.all([
      transaction.get(requesterRef),
      transaction.get(recipientRef),
      transaction.get(connRef),
    ]);

    if (!requesterSnap.exists) {
      throw new ConnectionServiceError("AUTH_REQUIRED", "Authentication required.", 401);
    }
    if (!recipientSnap.exists) {
      throw new ConnectionServiceError("USER_NOT_FOUND", "User not found.", 404);
    }

    const requesterData = requesterSnap.data() as Record<string, unknown>;
    const isPlus = requesterData.tier === "plus";

    if (connSnap.exists) {
      const current = parseConnection(connSnap.id, connSnap.data() as Record<string, unknown>);

      if (current.status === ACCEPTED) {
        throw new ConnectionServiceError("ALREADY_CONNECTED", "Already connected.", 409);
      }

      if (current.status === PENDING) {
        if (current.requesterId === requesterId) {
          throw new ConnectionServiceError("REQUEST_ALREADY_PENDING", "Request already pending.", 409);
        }
        if (current.recipientId === requesterId) {
          throw new ConnectionServiceError(
            "INCOMING_REQUEST_EXISTS",
            "Incoming request already exists. Respond to it in Network requests.",
            409,
          );
        }
      }

      if (!isPlus) {
        const usageSnap = await transaction.get(usageRef);
        const used = usageSnap.exists ? Number(usageSnap.data()?.count ?? 0) : 0;
        if (used >= FREE_MONTHLY_CONNECTION_REQUEST_LIMIT) {
          throw new ConnectionServiceError(
            "MONTHLY_LIMIT_REACHED",
            "Monthly request limit reached.",
            429,
          );
        }

        transaction.set(
          usageRef,
          {
            uid: requesterId,
            periodKey,
            count: used + 1,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }

      const updatePayload: Record<string, unknown> = {
        participantKey,
        participantIds,
        requesterId,
        recipientId,
        status: PENDING,
        updatedAt: FieldValue.serverTimestamp(),
        acceptedAt: FieldValue.delete(),
        declinedAt: FieldValue.delete(),
        canceledAt: FieldValue.delete(),
        removedAt: FieldValue.delete(),
      };
      if (input.reason) updatePayload.reason = input.reason;
      else updatePayload.reason = FieldValue.delete();
      if (introCheck.value) updatePayload.introMessage = introCheck.value;
      else updatePayload.introMessage = FieldValue.delete();

      transaction.set(
        connRef,
        updatePayload,
        { merge: true },
      );

      return {
        participantKey,
        status: PENDING,
        requesterId,
        recipientId,
        state: "outgoing-pending" as ConnectionRelationshipState,
      };
    }

    if (!isPlus) {
      const usageSnap = await transaction.get(usageRef);
      const used = usageSnap.exists ? Number(usageSnap.data()?.count ?? 0) : 0;
      if (used >= FREE_MONTHLY_CONNECTION_REQUEST_LIMIT) {
        throw new ConnectionServiceError(
          "MONTHLY_LIMIT_REACHED",
          "Monthly request limit reached.",
          429,
        );
      }

      transaction.set(
        usageRef,
        {
          uid: requesterId,
          periodKey,
          count: used + 1,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    const createPayload: Record<string, unknown> = {
      participantKey,
      participantIds,
      requesterId,
      recipientId,
      status: PENDING,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (input.reason) createPayload.reason = input.reason;
    if (introCheck.value) createPayload.introMessage = introCheck.value;

    transaction.set(connRef, createPayload);

    return {
      participantKey,
      status: PENDING,
      requesterId,
      recipientId,
      state: "outgoing-pending" as ConnectionRelationshipState,
    };
  });

  const requesterData = (await requesterRef.get()).data() as Record<string, unknown> | undefined;
  const actorName =
    typeof requesterData?.displayName === "string" && requesterData.displayName
      ? requesterData.displayName
      : "Someone";
  const actorPhotoURL =
    typeof requesterData?.photoURL === "string" ? requesterData.photoURL : null;

  createConnectionNotification({
    recipientId,
    type: "connection-request",
    actorId: requesterId,
    actorName,
    actorPhotoURL,
    message: `${actorName} sent you a connection request.`,
    linkURL: "/network?tab=requests",
  }).catch(() => {});

  return {
    participantKey: mutation.participantKey,
    status: mutation.status as ConnectionStatus,
    requesterId,
    recipientId,
    state: mutation.state as ConnectionRelationshipState,
  };
}

async function updatePendingStatus(
  participantKey: string,
  currentUid: string,
  mode: "accept" | "decline" | "cancel",
): Promise<MutationResult> {
  const ref = connectionRef(participantKey);
  const db = getFirebaseAdminDb();

  const result: MutationResult = await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) {
      throw new ConnectionServiceError("NOT_FOUND", "Connection request not found.", 404);
    }

    const current = parseConnection(snap.id, snap.data() as Record<string, unknown>);
    if (current.status !== PENDING) {
      throw new ConnectionServiceError("INVALID_TRANSITION", "Invalid state transition.", 409);
    }

    if (mode === "accept" || mode === "decline") {
      if (current.recipientId !== currentUid) {
        throw new ConnectionServiceError("PERMISSION_DENIED", "Permission denied.", 403);
      }
    }

    if (mode === "cancel" && current.requesterId !== currentUid) {
      throw new ConnectionServiceError("PERMISSION_DENIED", "Permission denied.", 403);
    }

    const nextStatus = mode === "accept" ? ACCEPTED : mode === "decline" ? DECLINED : CANCELED;

    transaction.update(ref, {
      status: nextStatus,
      updatedAt: FieldValue.serverTimestamp(),
      acceptedAt: mode === "accept" ? FieldValue.serverTimestamp() : FieldValue.delete(),
      declinedAt: mode === "decline" ? FieldValue.serverTimestamp() : FieldValue.delete(),
      canceledAt: mode === "cancel" ? FieldValue.serverTimestamp() : FieldValue.delete(),
    });

    return {
      participantKey,
      status: nextStatus,
      requesterId: current.requesterId,
      recipientId: current.recipientId,
      state: (nextStatus === ACCEPTED ? "connected" : "none") as ConnectionRelationshipState,
    };
  });

  if (mode === "accept") {
    const actorSnap = await getFirebaseAdminDb().collection("users").doc(currentUid).get();
    const actor = actorSnap.data() as Record<string, unknown> | undefined;
    const actorName =
      typeof actor?.displayName === "string" && actor.displayName ? actor.displayName : "Someone";
    createConnectionNotification({
      recipientId: result.requesterId,
      type: "connection-accepted",
      actorId: currentUid,
      actorName,
      actorPhotoURL: typeof actor?.photoURL === "string" ? actor.photoURL : null,
      message: `${actorName} accepted your connection request.`,
      linkURL: `/educators/${currentUid}`,
    }).catch(() => {});
  }

  return result;
}

export function acceptConnectionRequest(participantKey: string, uid: string): Promise<MutationResult> {
  return updatePendingStatus(participantKey, uid, "accept");
}

export function declineConnectionRequest(participantKey: string, uid: string): Promise<MutationResult> {
  return updatePendingStatus(participantKey, uid, "decline");
}

export function cancelConnectionRequest(participantKey: string, uid: string): Promise<MutationResult> {
  return updatePendingStatus(participantKey, uid, "cancel");
}

export async function removeConnection(participantKey: string, uid: string): Promise<MutationResult> {
  const ref = connectionRef(participantKey);
  const db = getFirebaseAdminDb();

  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) {
      throw new ConnectionServiceError("NOT_FOUND", "Connection not found.", 404);
    }

    const current = parseConnection(snap.id, snap.data() as Record<string, unknown>);
    if (current.status !== ACCEPTED) {
      throw new ConnectionServiceError("INVALID_TRANSITION", "Invalid state transition.", 409);
    }

    if (!current.participantIds.includes(uid)) {
      throw new ConnectionServiceError("PERMISSION_DENIED", "Permission denied.", 403);
    }

    transaction.update(ref, {
      status: REMOVED,
      updatedAt: FieldValue.serverTimestamp(),
      removedAt: FieldValue.serverTimestamp(),
    });

    return {
      participantKey,
      status: REMOVED,
      requesterId: current.requesterId,
      recipientId: current.recipientId,
      state: "none",
    };
  });
}

export async function listIncomingRequests(uid: string, pageSize = 20): Promise<ConnectionListItem[]> {
  const snap = await getFirebaseAdminDb()
    .collection("connections")
    .where("recipientId", "==", uid)
    .where("status", "==", PENDING)
    .orderBy("updatedAt", "desc")
    .limit(pageSize)
    .get();

  const records = snap.docs.map((docSnap) => parseConnection(docSnap.id, docSnap.data()));
  const usersById = await hydrateOtherUsers(records, uid);

  return records.map((record) => {
    const otherId = record.participantIds.find((participantId) => participantId !== uid) ?? "";
    return toItem(record, usersById.get(otherId) ?? null);
  });
}

export async function listSentRequests(uid: string, pageSize = 20): Promise<ConnectionListItem[]> {
  const snap = await getFirebaseAdminDb()
    .collection("connections")
    .where("requesterId", "==", uid)
    .where("status", "==", PENDING)
    .orderBy("updatedAt", "desc")
    .limit(pageSize)
    .get();

  const records = snap.docs.map((docSnap) => parseConnection(docSnap.id, docSnap.data()));
  const usersById = await hydrateOtherUsers(records, uid);

  return records.map((record) => {
    const otherId = record.participantIds.find((participantId) => participantId !== uid) ?? "";
    return toItem(record, usersById.get(otherId) ?? null);
  });
}

export async function listAcceptedConnections(uid: string, pageSize = 30): Promise<ConnectionListItem[]> {
  const snap = await getFirebaseAdminDb()
    .collection("connections")
    .where("participantIds", "array-contains", uid)
    .where("status", "==", ACCEPTED)
    .orderBy("updatedAt", "desc")
    .limit(pageSize)
    .get();

  const records = snap.docs.map((docSnap) => parseConnection(docSnap.id, docSnap.data()));
  const usersById = await hydrateOtherUsers(records, uid);

  return records.map((record) => {
    const otherId = record.participantIds.find((participantId) => participantId !== uid) ?? "";
    return toItem(record, usersById.get(otherId) ?? null);
  });
}

export async function getNetworkSummary(uid: string): Promise<{
  connections: number;
  incoming: number;
  sent: number;
  quota: ConnectionQuotaSummary;
}> {
  const db = getFirebaseAdminDb();
  const [connectionsSnap, incomingSnap, sentSnap, quota] = await Promise.all([
    db.collection("connections").where("participantIds", "array-contains", uid).where("status", "==", ACCEPTED).get(),
    db.collection("connections").where("recipientId", "==", uid).where("status", "==", PENDING).get(),
    db.collection("connections").where("requesterId", "==", uid).where("status", "==", PENDING).get(),
    getConnectionQuota(uid),
  ]);

  return {
    connections: connectionsSnap.size,
    incoming: incomingSnap.size,
    sent: sentSnap.size,
    quota,
  };
}

export async function cleanupConnectionsForDeletedUser(uid: string): Promise<void> {
  const db = getFirebaseAdminDb();

  const relatedSnap = await db
    .collection("connections")
    .where("participantIds", "array-contains", uid)
    .get();

  const batch = db.batch();
  relatedSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    const status = typeof data.status === "string" ? data.status : "";

    if (status === PENDING || status === ACCEPTED) {
      batch.update(docSnap.ref, {
        status: REMOVED,
        removedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    batch.delete(docSnap.ref);
  });

  if (!relatedSnap.empty) {
    await batch.commit();
  }

  const usageSnap = await db.collection(`users/${uid}/connectionRequestUsage`).get();
  if (!usageSnap.empty) {
    const usageBatch = db.batch();
    usageSnap.docs.forEach((docSnap) => usageBatch.delete(docSnap.ref));
    await usageBatch.commit();
  }
}
