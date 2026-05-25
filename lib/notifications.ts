import {
  doc,
  setDoc,
  updateDoc,
  writeBatch,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  where,
  serverTimestamp,
  startAfter,
  type DocumentSnapshot,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ---------------------------------------------------------------------------
// Notification types
// ---------------------------------------------------------------------------

export type NotificationType =
  | "new-follower"
  | "comment"
  | "upvote"
  | "badge-earned"
  | "resource-liked"
  | "mention";

export interface Notification {
  id: string;
  recipientId: string;
  type: NotificationType;
  read: boolean;
  createdAt: Timestamp | null;
  /** The user who triggered the notification. */
  actorId: string;
  actorName: string;
  actorPhotoURL: string | null;
  /** Human-readable message, e.g. "Alex liked your resource". */
  message: string;
  /** Where to navigate when the notification is clicked. */
  linkURL: string;
}

export type NotificationInput = Omit<Notification, "id" | "createdAt" | "read">;

// ---------------------------------------------------------------------------
// Firestore path helper
// Sub-collection: notifications/{recipientId}/items/{notificationId}
// ---------------------------------------------------------------------------

function notifCollection(recipientId: string) {
  if (!db) throw new Error("Firestore not initialized");
  return collection(db, "notifications", recipientId, "items");
}

// ---------------------------------------------------------------------------
// createNotification - write a new notification for a user
// ---------------------------------------------------------------------------

export async function createNotification(
  input: NotificationInput
): Promise<void> {
  if (!db) return;
  // Don't notify yourself
  if (input.actorId === input.recipientId) return;

  const ref = doc(notifCollection(input.recipientId));
  await setDoc(ref, {
    ...input,
    read: false,
    createdAt: serverTimestamp(),
  });
}

// ---------------------------------------------------------------------------
// getNotifications - fetch the most recent N notifications for a user
// ---------------------------------------------------------------------------

export async function getNotifications(
  recipientId: string,
  pageSize = 20,
  cursor: DocumentSnapshot | null = null
): Promise<{ notifications: Notification[]; lastDoc: DocumentSnapshot | null }> {
  if (!db) return { notifications: [], lastDoc: null };

  const constraints = [
    orderBy("createdAt", "desc"),
    limit(pageSize),
    ...(cursor ? [startAfter(cursor)] : []),
  ];

  const q = query(notifCollection(recipientId), ...constraints);
  const snap = await getDocs(q);
  const notifications: Notification[] = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Notification, "id">),
  }));
  const lastDoc = snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1] : null;
  return { notifications, lastDoc };
}

// ---------------------------------------------------------------------------
// subscribeToNotifications - real-time listener (returns unsubscribe fn)
// ---------------------------------------------------------------------------

export function subscribeToNotifications(
  recipientId: string,
  pageSize: number,
  onUpdate: (notifications: Notification[]) => void
): Unsubscribe {
  if (!db) return () => {};
  const q = query(
    notifCollection(recipientId),
    orderBy("createdAt", "desc"),
    limit(pageSize)
  );
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Notification, "id">),
    }));
    onUpdate(items);
  });
}

// ---------------------------------------------------------------------------
// markAsRead - mark a single notification as read
// ---------------------------------------------------------------------------

export async function markAsRead(
  recipientId: string,
  notificationId: string
): Promise<void> {
  if (!db) return;
  await updateDoc(
    doc(notifCollection(recipientId), notificationId),
    { read: true }
  );
}

// ---------------------------------------------------------------------------
// markAllAsRead - batch-mark all unread notifications as read
// ---------------------------------------------------------------------------

export async function markAllAsRead(recipientId: string): Promise<void> {
  if (!db) return;
  const q = query(
    notifCollection(recipientId),
    where("read", "==", false),
    limit(50)
  );
  const snap = await getDocs(q);
  if (snap.empty) return;

  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
  await batch.commit();
}

// ---------------------------------------------------------------------------
// Convenience notification creators (call these from action handlers)
// ---------------------------------------------------------------------------

export function notifyNewFollower(params: {
  recipientId: string;
  actorId: string;
  actorName: string;
  actorPhotoURL: string | null;
}): Promise<void> {
  return createNotification({
    recipientId: params.recipientId,
    type: "new-follower",
    actorId: params.actorId,
    actorName: params.actorName,
    actorPhotoURL: params.actorPhotoURL,
    message: `${params.actorName} started following you.`,
    linkURL: `/educators/${params.actorId}`,
  });
}

export function notifyComment(params: {
  recipientId: string;
  actorId: string;
  actorName: string;
  actorPhotoURL: string | null;
  contentLabel: string; // e.g. "your post", "your resource"
  linkURL: string;
}): Promise<void> {
  return createNotification({
    recipientId: params.recipientId,
    type: "comment",
    actorId: params.actorId,
    actorName: params.actorName,
    actorPhotoURL: params.actorPhotoURL,
    message: `${params.actorName} commented on ${params.contentLabel}.`,
    linkURL: params.linkURL,
  });
}

export function notifyUpvote(params: {
  recipientId: string;
  actorId: string;
  actorName: string;
  actorPhotoURL: string | null;
  threadTitle: string;
  linkURL: string;
}): Promise<void> {
  return createNotification({
    recipientId: params.recipientId,
    type: "upvote",
    actorId: params.actorId,
    actorName: params.actorName,
    actorPhotoURL: params.actorPhotoURL,
    message: `${params.actorName} upvoted your discussion "${params.threadTitle}".`,
    linkURL: params.linkURL,
  });
}

export function notifyBadgeEarned(params: {
  recipientId: string;
  badgeLabel: string;
}): Promise<void> {
  return createNotification({
    recipientId: params.recipientId,
    type: "badge-earned",
    actorId: params.recipientId, // self-triggered
    actorName: "EduConnect",
    actorPhotoURL: null,
    message: `You earned the "${params.badgeLabel}" badge! 🎉`,
    linkURL: `/educators/${params.recipientId}`,
  });
}

export function notifyResourceLiked(params: {
  recipientId: string;
  actorId: string;
  actorName: string;
  actorPhotoURL: string | null;
  resourceTitle: string;
  linkURL: string;
}): Promise<void> {
  return createNotification({
    recipientId: params.recipientId,
    type: "resource-liked",
    actorId: params.actorId,
    actorName: params.actorName,
    actorPhotoURL: params.actorPhotoURL,
    message: `${params.actorName} saved your resource "${params.resourceTitle}".`,
    linkURL: params.linkURL,
  });
}

export function notifyMention(params: {
  recipientId: string;
  actorId: string;
  actorName: string;
  actorPhotoURL: string | null;
  linkURL: string;
}): Promise<void> {
  return createNotification({
    recipientId: params.recipientId,
    type: "mention",
    actorId: params.actorId,
    actorName: params.actorName,
    actorPhotoURL: params.actorPhotoURL,
    message: `${params.actorName} mentioned you.`,
    linkURL: params.linkURL,
  });
}
