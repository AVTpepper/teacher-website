import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
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
  | "connection-request"
  | "connection-accepted"
  | "message-received"
  | "comment"
  | "upvote"
  | "badge-earned"
  | "resource-liked"
  | "mention"
  | "lesson-rated"
  | "lesson-downloaded"
  | "resource-downloaded"
  | "lesson-shared"
  | "resource-shared"
  | "comment-replied";

export interface Notification {
  id: string;
  recipientId: string;
  type: NotificationType;
  read: boolean;
  dismissed: boolean;
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

export type NotificationInput = Omit<Notification, "id" | "createdAt" | "read" | "dismissed">;

export function normalizeNotificationLink(linkURL: string): string {
  const trimmed = linkURL.trim();
  if (!trimmed) return "/notifications";

  try {
    const parsed = trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? new URL(trimmed)
      : new URL(trimmed, "http://localhost");

    if (parsed.pathname === "/" && parsed.searchParams.has("post")) {
      return `/home${parsed.search}${parsed.hash}`;
    }

    const normalizedPath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return normalizedPath || "/notifications";
  } catch {
    if (trimmed.startsWith("/?post=")) {
      return `/home${trimmed.slice(1)}`;
    }

    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  }
}

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
  // Don't notify yourself (except for system notifications which use 'system' as actorId)
  if (input.actorId !== "system" && input.actorId === input.recipientId) return;

  const ref = doc(notifCollection(input.recipientId));
  await setDoc(ref, {
    ...input,
    read: false,
    dismissed: false,
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
  // Fetch more than needed so filtering dismissed still gives us enough to show
  const q = query(
    notifCollection(recipientId),
    orderBy("createdAt", "desc"),
    limit(pageSize * 3)
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

export async function markNotificationsAsRead(
  recipientId: string,
  ids: string[]
): Promise<void> {
  if (!db || ids.length === 0) return;
  const batch = writeBatch(db);
  ids.forEach((id) => {
    batch.update(doc(notifCollection(recipientId), id), { read: true });
  });
  await batch.commit();
}

export async function markNotificationsAsUnread(
  recipientId: string,
  ids: string[]
): Promise<void> {
  if (!db || ids.length === 0) return;
  const batch = writeBatch(db);
  ids.forEach((id) => {
    batch.update(doc(notifCollection(recipientId), id), { read: false });
  });
  await batch.commit();
}

// ---------------------------------------------------------------------------
// dismissNotification - hide a single notification from the dropdown permanently
// ---------------------------------------------------------------------------

export async function dismissNotification(
  recipientId: string,
  notificationId: string
): Promise<void> {
  if (!db) return;
  await updateDoc(
    doc(notifCollection(recipientId), notificationId),
    { dismissed: true }
  );
}

// ---------------------------------------------------------------------------
// dismissAllVisible - soft-hide a list of notification ids from the dropdown
// ---------------------------------------------------------------------------

export async function dismissAllVisible(
  recipientId: string,
  ids: string[]
): Promise<void> {
  if (!db || ids.length === 0) return;
  const batch = writeBatch(db);
  ids.forEach((id) =>
    batch.update(doc(notifCollection(recipientId), id), { dismissed: true })
  );
  await batch.commit();
}

export async function deleteNotification(
  recipientId: string,
  notificationId: string
): Promise<void> {
  if (!db) return;
  await deleteDoc(doc(notifCollection(recipientId), notificationId));
}

export async function deleteNotifications(
  recipientId: string,
  ids: string[]
): Promise<void> {
  if (!db || ids.length === 0) return;
  const batch = writeBatch(db);
  ids.forEach((id) => {
    batch.delete(doc(notifCollection(recipientId), id));
  });
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

export function notifyConnectionRequest(params: {
  recipientId: string;
  actorId: string;
  actorName: string;
  actorPhotoURL: string | null;
}): Promise<void> {
  return createNotification({
    recipientId: params.recipientId,
    type: "connection-request",
    actorId: params.actorId,
    actorName: params.actorName,
    actorPhotoURL: params.actorPhotoURL,
    message: `${params.actorName} sent you a connection request.`,
    linkURL: "/network?tab=requests",
  });
}

export function notifyConnectionAccepted(params: {
  recipientId: string;
  actorId: string;
  actorName: string;
  actorPhotoURL: string | null;
  profileId: string;
}): Promise<void> {
  return createNotification({
    recipientId: params.recipientId,
    type: "connection-accepted",
    actorId: params.actorId,
    actorName: params.actorName,
    actorPhotoURL: params.actorPhotoURL,
    message: `${params.actorName} accepted your connection request.`,
    linkURL: `/educators/${params.profileId}`,
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
    actorId: "system", // sentinel — bypasses self-notification guard
    actorName: "VistaTeacher",
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

export function notifyLessonRated(params: {
  recipientId: string;
  actorId: string;
  actorName: string;
  actorPhotoURL: string | null;
  lessonTitle: string;
  linkURL: string;
}): Promise<void> {
  return createNotification({
    recipientId: params.recipientId,
    type: "lesson-rated",
    actorId: params.actorId,
    actorName: params.actorName,
    actorPhotoURL: params.actorPhotoURL,
    message: `${params.actorName} rated your lesson "${params.lessonTitle}".`,
    linkURL: params.linkURL,
  });
}

export function notifyLessonDownloaded(params: {
  recipientId: string;
  actorId: string;
  actorName: string;
  actorPhotoURL: string | null;
  lessonTitle: string;
  linkURL: string;
}): Promise<void> {
  return createNotification({
    recipientId: params.recipientId,
    type: "lesson-downloaded",
    actorId: params.actorId,
    actorName: params.actorName,
    actorPhotoURL: params.actorPhotoURL,
    message: `${params.actorName} downloaded your lesson "${params.lessonTitle}".`,
    linkURL: params.linkURL,
  });
}

export function notifyResourceDownloaded(params: {
  recipientId: string;
  actorId: string;
  actorName: string;
  actorPhotoURL: string | null;
  resourceTitle: string;
  linkURL: string;
}): Promise<void> {
  return createNotification({
    recipientId: params.recipientId,
    type: "resource-downloaded",
    actorId: params.actorId,
    actorName: params.actorName,
    actorPhotoURL: params.actorPhotoURL,
    message: `${params.actorName} downloaded your resource "${params.resourceTitle}".`,
    linkURL: params.linkURL,
  });
}

export function notifyLessonShared(params: {
  recipientId: string;
  actorId: string;
  actorName: string;
  actorPhotoURL: string | null;
  lessonTitle: string;
  linkURL: string;
}): Promise<void> {
  return createNotification({
    recipientId: params.recipientId,
    type: "lesson-shared",
    actorId: params.actorId,
    actorName: params.actorName,
    actorPhotoURL: params.actorPhotoURL,
    message: `${params.actorName} shared your lesson "${params.lessonTitle}".`,
    linkURL: params.linkURL,
  });
}

export function notifyResourceShared(params: {
  recipientId: string;
  actorId: string;
  actorName: string;
  actorPhotoURL: string | null;
  resourceTitle: string;
  linkURL: string;
}): Promise<void> {
  return createNotification({
    recipientId: params.recipientId,
    type: "resource-shared",
    actorId: params.actorId,
    actorName: params.actorName,
    actorPhotoURL: params.actorPhotoURL,
    message: `${params.actorName} shared your resource "${params.resourceTitle}".`,
    linkURL: params.linkURL,
  });
}

export function notifyCommentReplied(params: {
  recipientId: string;
  actorId: string;
  actorName: string;
  actorPhotoURL: string | null;
  linkURL: string;
}): Promise<void> {
  return createNotification({
    recipientId: params.recipientId,
    type: "comment-replied",
    actorId: params.actorId,
    actorName: params.actorName,
    actorPhotoURL: params.actorPhotoURL,
    message: `${params.actorName} replied to your comment.`,
    linkURL: params.linkURL,
  });
}
