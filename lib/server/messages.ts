import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  FREE_MONTHLY_SENT_MESSAGE_LIMIT,
  MESSAGE_CONVERSATION_STATUSES,
  MESSAGE_TYPE_VALUES,
} from "@/lib/messages/constants";
import type {
  ConversationDetail,
  ConversationListItem,
  MessageConversationRecord,
  MessageItem,
  MessageQuotaSummary,
  MessageRecord,
  MessageUserSummary,
} from "@/lib/messages/types";
import {
  buildMessagePreview,
  evaluateMessageQuota,
  getUtcMonthKey,
  normalizeIdempotencyKey,
  normalizeMessageBody,
} from "@/lib/messages/utils";
import { buildParticipantKey, normalizeTier } from "@/lib/network/utils";
import { getFirebaseAdminDb } from "@/lib/server/firebaseAdmin";

const ACTIVE_STATUS = "active";
const TEXT_TYPE = MESSAGE_TYPE_VALUES[0];
const CONVERSATION_STATUS_SET = new Set<string>(MESSAGE_CONVERSATION_STATUSES);
const MESSAGE_TYPE_SET = new Set<string>(MESSAGE_TYPE_VALUES);

export class MessageServiceError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "MessageServiceError";
    this.code = code;
    this.status = status;
  }
}

interface GetOrCreateConversationInput {
  currentUid: string;
  targetUid: string;
}

interface SendMessageInput {
  senderUid: string;
  conversationId: string;
  body: string;
  idempotencyKey: string;
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

function parseConversation(docId: string, data: Record<string, unknown>): MessageConversationRecord {
  const rawStatus = typeof data.status === "string" ? data.status : ACTIVE_STATUS;
  const status = (CONVERSATION_STATUS_SET.has(rawStatus) ? rawStatus : ACTIVE_STATUS) as "active";

  return {
    id: docId,
    conversationId: String(data.conversationId ?? docId),
    participantIds: Array.isArray(data.participantIds)
      ? data.participantIds.filter((value): value is string => typeof value === "string")
      : [],
    participantKey: typeof data.participantKey === "string" ? data.participantKey : docId,
    createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    lastMessageAt: data.lastMessageAt,
    lastMessagePreview: typeof data.lastMessagePreview === "string" ? data.lastMessagePreview : undefined,
    lastMessageSenderUid:
      typeof data.lastMessageSenderUid === "string" ? data.lastMessageSenderUid : undefined,
    unreadBy:
      typeof data.unreadBy === "object" && data.unreadBy !== null
        ? (data.unreadBy as Record<string, number>)
        : undefined,
    lastReadAtBy:
      typeof data.lastReadAtBy === "object" && data.lastReadAtBy !== null
        ? (data.lastReadAtBy as Record<string, unknown>)
        : undefined,
    lastReadMessageIdBy:
      typeof data.lastReadMessageIdBy === "object" && data.lastReadMessageIdBy !== null
        ? (data.lastReadMessageIdBy as Record<string, string | null>)
        : undefined,
    status,
  };
}

function parseMessage(docId: string, data: Record<string, unknown>): MessageRecord {
  const rawType = typeof data.messageType === "string" ? data.messageType : TEXT_TYPE;
  const messageType = (MESSAGE_TYPE_SET.has(rawType) ? rawType : TEXT_TYPE) as "text";

  return {
    id: docId,
    senderUid: typeof data.senderUid === "string" ? data.senderUid : "",
    body: typeof data.body === "string" ? data.body : "",
    createdAt: data.createdAt,
    messageType,
    idempotencyKey: typeof data.idempotencyKey === "string" ? data.idempotencyKey : "",
  };
}

function conversationRef(conversationId: string) {
  return getFirebaseAdminDb().collection("conversations").doc(conversationId);
}

function connectionRef(participantKey: string) {
  return getFirebaseAdminDb().collection("connections").doc(participantKey);
}

function messageUsageRef(uid: string, periodKey: string) {
  return getFirebaseAdminDb().doc(`users/${uid}/messageUsage/${periodKey}`);
}

async function getTier(uid: string): Promise<"free" | "plus"> {
  const profileSnap = await getFirebaseAdminDb().collection("users").doc(uid).get();
  const data = profileSnap.exists ? (profileSnap.data() as Record<string, unknown>) : null;
  return normalizeTier(data?.tier);
}

function toSummary(data: Record<string, unknown> | null, uid: string): MessageUserSummary | null {
  if (!data) return null;
  return {
    uid,
    displayName: typeof data.displayName === "string" ? data.displayName : "Deleted account",
    photoURL: typeof data.photoURL === "string" ? data.photoURL : null,
    professionalHeadline:
      typeof data.professionalHeadline === "string" ? data.professionalHeadline : undefined,
    professionalRole: typeof data.professionalRole === "string" ? data.professionalRole : undefined,
  };
}

async function hydrateUsers(userIds: string[]): Promise<Map<string, MessageUserSummary | null>> {
  const ids = Array.from(new Set(userIds.map((id) => id.trim()).filter(Boolean)));
  if (ids.length === 0) return new Map();

  const db = getFirebaseAdminDb();
  const refs = ids.map((uid) => db.collection("users").doc(uid));
  const snaps = await db.getAll(...refs);

  const map = new Map<string, MessageUserSummary | null>();
  snaps.forEach((snap) => {
    const data = snap.exists ? (snap.data() as Record<string, unknown>) : null;
    map.set(snap.id, toSummary(data, snap.id));
  });

  return map;
}

async function ensureConversationParticipant(
  uid: string,
  conversationId: string,
): Promise<MessageConversationRecord> {
  if (!conversationId.trim()) {
    throw new MessageServiceError("NOT_FOUND", "Conversation not found.", 404);
  }

  const snap = await conversationRef(conversationId).get();
  if (!snap.exists) {
    throw new MessageServiceError("NOT_FOUND", "Conversation not found.", 404);
  }

  const conversation = parseConversation(snap.id, snap.data() as Record<string, unknown>);
  if (!conversation.participantIds.includes(uid)) {
    throw new MessageServiceError("PERMISSION_DENIED", "Permission denied.", 403);
  }

  return conversation;
}

async function isConnectionAcceptedBetween(uidA: string, uidB: string): Promise<boolean> {
  const participantKey = buildParticipantKey(uidA, uidB);
  const snap = await connectionRef(participantKey).get();
  if (!snap.exists) return false;

  const data = snap.data() as Record<string, unknown>;
  return data.status === "accepted";
}

async function createMessageNotification(input: {
  recipientId: string;
  actorId: string;
  actorName: string;
  actorPhotoURL: string | null;
  message: string;
  linkURL: string;
}): Promise<void> {
  if (input.actorId === input.recipientId) return;

  await getFirebaseAdminDb().collection(`notifications/${input.recipientId}/items`).add({
    recipientId: input.recipientId,
    type: "message-received",
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

export async function getMessageQuota(uid: string): Promise<MessageQuotaSummary> {
  const tier = await getTier(uid);
  const periodKey = getUtcMonthKey();

  if (tier === "plus") {
    const summary = evaluateMessageQuota({ used: 0, isUnlimited: true });
    return {
      periodKey,
      isUnlimited: true,
      limit: summary.limit,
      used: summary.used,
      remaining: summary.remaining,
      canSend: summary.canSend,
    };
  }

  const usageSnap = await messageUsageRef(uid, periodKey).get();
  const used = usageSnap.exists ? Number(usageSnap.data()?.count ?? 0) : 0;
  const summary = evaluateMessageQuota({
    used,
    isUnlimited: false,
    limit: FREE_MONTHLY_SENT_MESSAGE_LIMIT,
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

function toConversationListItem(
  record: MessageConversationRecord,
  uid: string,
  otherUser: MessageUserSummary | null,
  canSend: boolean,
): ConversationListItem {
  return {
    conversationId: record.conversationId,
    participantKey: record.participantKey,
    status: record.status,
    otherUser,
    lastMessageAt: asIso(record.lastMessageAt),
    lastMessagePreview: record.lastMessagePreview,
    lastMessageSenderUid: record.lastMessageSenderUid,
    unreadCount: Number(record.unreadBy?.[uid] ?? 0),
    canSend,
    createdAt: asIso(record.createdAt),
  };
}

export async function getOrCreateConversation(
  input: GetOrCreateConversationInput,
): Promise<ConversationDetail> {
  const currentUid = input.currentUid.trim();
  const targetUid = input.targetUid.trim();

  if (!currentUid) {
    throw new MessageServiceError("AUTH_REQUIRED", "Authentication required.", 401);
  }
  if (!targetUid) {
    throw new MessageServiceError("USER_NOT_FOUND", "User not found.", 404);
  }
  if (currentUid === targetUid) {
    throw new MessageServiceError("INVALID_PARTICIPANT", "Cannot message yourself.", 400);
  }

  const db = getFirebaseAdminDb();
  const participantKey = buildParticipantKey(currentUid, targetUid);
  const convRef = conversationRef(participantKey);
  const [currentUserSnap, targetUserSnap, connSnap] = await Promise.all([
    db.collection("users").doc(currentUid).get(),
    db.collection("users").doc(targetUid).get(),
    connectionRef(participantKey).get(),
  ]);

  if (!currentUserSnap.exists) {
    throw new MessageServiceError("AUTH_REQUIRED", "Authentication required.", 401);
  }
  if (!targetUserSnap.exists) {
    throw new MessageServiceError("USER_NOT_FOUND", "User not found.", 404);
  }

  const isAcceptedConnection = connSnap.exists && connSnap.data()?.status === "accepted";
  if (!isAcceptedConnection) {
    throw new MessageServiceError(
      "CONNECTION_REQUIRED",
      "Only accepted connections can message each other.",
      403,
    );
  }

  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(convRef);
    if (existing.exists) {
      const existingData = parseConversation(existing.id, existing.data() as Record<string, unknown>);
      if (!existingData.participantIds.includes(currentUid)) {
        throw new MessageServiceError("PERMISSION_DENIED", "Permission denied.", 403);
      }
      return;
    }

    transaction.set(convRef, {
      conversationId: participantKey,
      participantIds: [currentUid, targetUid].sort(),
      participantKey,
      createdBy: currentUid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      unreadBy: {
        [currentUid]: 0,
        [targetUid]: 0,
      },
      lastReadAtBy: {
        [currentUid]: FieldValue.serverTimestamp(),
        [targetUid]: null,
      },
      lastReadMessageIdBy: {
        [currentUid]: null,
        [targetUid]: null,
      },
      status: ACTIVE_STATUS,
    });
  });

  return getConversation(currentUid, participantKey);
}

export async function listConversations(uid: string, pageSize = 20): Promise<ConversationListItem[]> {
  const currentUid = uid.trim();
  if (!currentUid) {
    throw new MessageServiceError("AUTH_REQUIRED", "Authentication required.", 401);
  }

  const snap = await getFirebaseAdminDb()
    .collection("conversations")
    .where("participantIds", "array-contains", currentUid)
    .where("status", "==", ACTIVE_STATUS)
    .orderBy("lastMessageAt", "desc")
    .limit(pageSize)
    .get();

  const records = snap.docs.map((docSnap) => parseConversation(docSnap.id, docSnap.data()));
  const otherUids = records
    .map((record) => record.participantIds.find((id) => id !== currentUid) ?? "")
    .filter(Boolean);
  const usersById = await hydrateUsers(otherUids);

  const connectionKeys = records
    .map((record) => {
      const otherUid = record.participantIds.find((id) => id !== currentUid);
      if (!otherUid) return null;
      return {
        conversationId: record.conversationId,
        otherUid,
        key: buildParticipantKey(currentUid, otherUid),
      };
    })
    .filter((value): value is { conversationId: string; otherUid: string; key: string } => value !== null);

  const uniqueConnectionKeys = Array.from(new Set(connectionKeys.map((value) => value.key)));
  const connRefs = uniqueConnectionKeys.map((key) => connectionRef(key));
  const connSnaps = connRefs.length > 0 ? await getFirebaseAdminDb().getAll(...connRefs) : [];
  const acceptedByKey = new Map<string, boolean>();
  connSnaps.forEach((docSnap) => {
    acceptedByKey.set(docSnap.id, docSnap.exists && docSnap.data()?.status === "accepted");
  });

  return records.map((record) => {
    const otherUid = record.participantIds.find((id) => id !== currentUid) ?? "";
    const otherUser = usersById.get(otherUid) ?? null;
    const key = otherUid ? buildParticipantKey(currentUid, otherUid) : "";
    const canSend = Boolean(otherUid) && acceptedByKey.get(key) === true;
    return toConversationListItem(record, currentUid, otherUser, canSend);
  });
}

export async function getConversation(uid: string, conversationId: string): Promise<ConversationDetail> {
  const conversation = await ensureConversationParticipant(uid, conversationId);
  const usersById = await hydrateUsers(conversation.participantIds);

  const participants = conversation.participantIds
    .map((id) => usersById.get(id))
    .filter((value): value is MessageUserSummary => value !== null);

  const otherUid = conversation.participantIds.find((id) => id !== uid) ?? "";
  const otherUser = usersById.get(otherUid) ?? null;
  const canSend = otherUid ? await isConnectionAcceptedBetween(uid, otherUid) : false;

  return {
    conversationId: conversation.conversationId,
    participantKey: conversation.participantKey,
    status: conversation.status,
    participants,
    otherUser,
    canSend,
    unreadCount: Number(conversation.unreadBy?.[uid] ?? 0),
    lastMessageAt: asIso(conversation.lastMessageAt),
    lastMessagePreview: conversation.lastMessagePreview,
    lastMessageSenderUid: conversation.lastMessageSenderUid,
    createdAt: asIso(conversation.createdAt),
  };
}

export async function listMessages(
  uid: string,
  conversationId: string,
  options?: { limit?: number; beforeCreatedAt?: string },
): Promise<{
  items: MessageItem[];
  hasMore: boolean;
  nextCursorCreatedAt?: string;
}> {
  await ensureConversationParticipant(uid, conversationId);

  const pageSize = Math.min(Math.max(options?.limit ?? 30, 1), 100);
  const messagesRef = conversationRef(conversationId).collection("messages");

  let query = messagesRef.orderBy("createdAt", "desc").limit(pageSize);
  if (options?.beforeCreatedAt) {
    const beforeDate = new Date(options.beforeCreatedAt);
    if (!Number.isNaN(beforeDate.getTime())) {
      query = query.startAfter(Timestamp.fromDate(beforeDate));
    }
  }

  const snap = await query.get();
  const items = snap.docs
    .map((docSnap) => parseMessage(docSnap.id, docSnap.data() as Record<string, unknown>))
    .map((record) => ({
      id: record.id,
      senderUid: record.senderUid,
      body: record.body,
      createdAt: asIso(record.createdAt),
      messageType: record.messageType,
    }));

  const nextCursorCreatedAt = items.length > 0 ? items[items.length - 1].createdAt : undefined;

  return {
    items,
    hasMore: snap.size === pageSize,
    nextCursorCreatedAt,
  };
}

export async function sendMessage(input: SendMessageInput): Promise<{
  conversationId: string;
  message: MessageItem;
  quota: MessageQuotaSummary;
  created: boolean;
}> {
  const senderUid = input.senderUid.trim();
  const conversationId = input.conversationId.trim();

  if (!senderUid) {
    throw new MessageServiceError("AUTH_REQUIRED", "Authentication required.", 401);
  }

  const bodyCheck = normalizeMessageBody(input.body);
  if (bodyCheck.error || !bodyCheck.value) {
    throw new MessageServiceError("INVALID_MESSAGE_BODY", bodyCheck.error ?? "Invalid message body.", 400);
  }
  const messageBody = bodyCheck.value;

  const keyCheck = normalizeIdempotencyKey(input.idempotencyKey);
  if (keyCheck.error || !keyCheck.value) {
    throw new MessageServiceError("INVALID_IDEMPOTENCY_KEY", keyCheck.error ?? "Invalid idempotency key.", 400);
  }

  const db = getFirebaseAdminDb();
  const convRef = conversationRef(conversationId);
  const periodKey = getUtcMonthKey();
  const usageRef = messageUsageRef(senderUid, periodKey);

  const transactionResult = await db.runTransaction(async (transaction) => {
    const convSnap = await transaction.get(convRef);
    if (!convSnap.exists) {
      throw new MessageServiceError("NOT_FOUND", "Conversation not found.", 404);
    }

    const conversation = parseConversation(convSnap.id, convSnap.data() as Record<string, unknown>);
    if (!conversation.participantIds.includes(senderUid)) {
      throw new MessageServiceError("PERMISSION_DENIED", "Permission denied.", 403);
    }

    const recipientUid = conversation.participantIds.find((id) => id !== senderUid);
    if (!recipientUid) {
      throw new MessageServiceError("INVALID_CONVERSATION", "Conversation is no longer available.", 409);
    }

    const connRef = connectionRef(buildParticipantKey(senderUid, recipientUid));
    const [connSnap, senderSnap, usageSnap] = await Promise.all([
      transaction.get(connRef),
      transaction.get(db.collection("users").doc(senderUid)),
      transaction.get(usageRef),
    ]);

    if (!senderSnap.exists) {
      throw new MessageServiceError("AUTH_REQUIRED", "Authentication required.", 401);
    }

    if (!connSnap.exists || connSnap.data()?.status !== "accepted") {
      throw new MessageServiceError(
        "CONNECTION_REQUIRED",
        "Only accepted connections can message each other.",
        403,
      );
    }

    const senderData = senderSnap.data() as Record<string, unknown>;
    const isPlus = normalizeTier(senderData.tier) === "plus";

    const idempotencyRef = convRef.collection("idempotency").doc(`${senderUid}_${keyCheck.value}`);
    const idempotencySnap = await transaction.get(idempotencyRef);
    if (idempotencySnap.exists) {
      return {
        created: false,
        messageId: String(idempotencySnap.data()?.messageId ?? ""),
        recipientUid,
      };
    }

    if (!isPlus) {
      const used = usageSnap.exists ? Number(usageSnap.data()?.count ?? 0) : 0;
      if (used >= FREE_MONTHLY_SENT_MESSAGE_LIMIT) {
        throw new MessageServiceError("MONTHLY_LIMIT_REACHED", "Monthly message limit reached.", 429);
      }

      transaction.set(
        usageRef,
        {
          uid: senderUid,
          periodKey,
          count: used + 1,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    const messageRef = convRef.collection("messages").doc();
    transaction.set(messageRef, {
      senderUid,
      body: messageBody,
      createdAt: FieldValue.serverTimestamp(),
      messageType: TEXT_TYPE,
      idempotencyKey: keyCheck.value,
    });

    const unreadBy = conversation.unreadBy ?? {};
    const senderUnread = Number(unreadBy[senderUid] ?? 0);
    const recipientUnread = Number(unreadBy[recipientUid] ?? 0);

    transaction.update(convRef, {
      lastMessageAt: FieldValue.serverTimestamp(),
      lastMessagePreview: buildMessagePreview(messageBody),
      lastMessageSenderUid: senderUid,
      updatedAt: FieldValue.serverTimestamp(),
      [`unreadBy.${senderUid}`]: Math.max(0, senderUnread),
      [`unreadBy.${recipientUid}`]: Math.max(0, recipientUnread) + 1,
      [`lastReadAtBy.${senderUid}`]: FieldValue.serverTimestamp(),
      [`lastReadMessageIdBy.${senderUid}`]: messageRef.id,
    });

    transaction.set(idempotencyRef, {
      senderUid,
      idempotencyKey: keyCheck.value,
      messageId: messageRef.id,
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      created: true,
      messageId: messageRef.id,
      recipientUid,
    };
  });

  const messageSnap = await convRef.collection("messages").doc(transactionResult.messageId).get();
  if (!messageSnap.exists) {
    throw new MessageServiceError("NOT_FOUND", "Message not found after send.", 500);
  }

  const messageRecord = parseMessage(messageSnap.id, messageSnap.data() as Record<string, unknown>);
  const quota = await getMessageQuota(senderUid);

  const actorSnap = await getFirebaseAdminDb().collection("users").doc(senderUid).get();
  const actorData = actorSnap.exists ? (actorSnap.data() as Record<string, unknown>) : null;
  const actorName =
    typeof actorData?.displayName === "string" && actorData.displayName
      ? actorData.displayName
      : "Someone";

  if (transactionResult.created) {
    createMessageNotification({
      recipientId: transactionResult.recipientUid,
      actorId: senderUid,
      actorName,
      actorPhotoURL: typeof actorData?.photoURL === "string" ? actorData.photoURL : null,
      message: `${actorName} sent you a message.`,
      linkURL: `/messages/${conversationId}`,
    }).catch(() => {});
  }

  return {
    conversationId,
    message: {
      id: messageRecord.id,
      senderUid: messageRecord.senderUid,
      body: messageRecord.body,
      createdAt: asIso(messageRecord.createdAt),
      messageType: messageRecord.messageType,
    },
    quota,
    created: transactionResult.created,
  };
}

export async function markConversationRead(input: {
  uid: string;
  conversationId: string;
  lastReadMessageId?: string;
}): Promise<{ conversationId: string; unreadCount: number }> {
  const uid = input.uid.trim();
  const conversationId = input.conversationId.trim();
  if (!uid) {
    throw new MessageServiceError("AUTH_REQUIRED", "Authentication required.", 401);
  }

  const conversation = await ensureConversationParticipant(uid, conversationId);

  const updatePayload: Record<string, unknown> = {
    [`unreadBy.${uid}`]: 0,
    [`lastReadAtBy.${uid}`]: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (input.lastReadMessageId?.trim()) {
    updatePayload[`lastReadMessageIdBy.${uid}`] = input.lastReadMessageId.trim();
  }

  await conversationRef(conversation.conversationId).set(updatePayload, { merge: true });

  return {
    conversationId: conversation.conversationId,
    unreadCount: 0,
  };
}

export async function cleanupMessagingForDeletedUser(uid: string): Promise<void> {
  const db = getFirebaseAdminDb();
  const related = await db
    .collection("conversations")
    .where("participantIds", "array-contains", uid)
    .get();

  for (const conversationDoc of related.docs) {
    const data = parseConversation(conversationDoc.id, conversationDoc.data() as Record<string, unknown>);
    const remainingParticipants = data.participantIds.filter((participantId) => participantId !== uid);

    if (remainingParticipants.length === 0) {
      await db.recursiveDelete(conversationDoc.ref);
      continue;
    }

    await conversationDoc.ref.set(
      {
        participantIds: remainingParticipants,
        updatedAt: FieldValue.serverTimestamp(),
        [`unreadBy.${uid}`]: FieldValue.delete(),
        [`lastReadAtBy.${uid}`]: FieldValue.delete(),
        [`lastReadMessageIdBy.${uid}`]: FieldValue.delete(),
      },
      { merge: true },
    );

    let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    while (true) {
      let query = conversationDoc.ref
        .collection("messages")
        .where("senderUid", "==", uid)
        .limit(100);
      if (cursor) {
        query = query.startAfter(cursor);
      }

      const messagesSnap = await query.get();
      if (messagesSnap.empty) break;

      const batch = db.batch();
      messagesSnap.docs.forEach((messageDoc) => {
        batch.set(
          messageDoc.ref,
          {
            senderUid: "deleted-user",
          },
          { merge: true },
        );
      });
      await batch.commit();

      cursor = messagesSnap.docs[messagesSnap.docs.length - 1] ?? null;
      if (messagesSnap.size < 100) break;
    }
  }

  const usageSnap = await db.collection(`users/${uid}/messageUsage`).get();
  if (!usageSnap.empty) {
    const batch = db.batch();
    usageSnap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
  }
}
