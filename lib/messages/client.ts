import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ConversationDetail, ConversationListItem, MessageItem, MessageQuotaSummary } from "@/lib/messages/types";

export class MessageClientError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "MessageClientError";
    this.code = code;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
  } & T;

  if (!response.ok) {
    throw new MessageClientError(payload.error ?? "Request failed.", payload.code);
  }

  return payload;
}

async function authHeaders(getToken: () => Promise<string>): Promise<HeadersInit> {
  const token = await getToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function getOrCreateConversation(
  getToken: () => Promise<string>,
  targetUid: string,
): Promise<ConversationDetail> {
  const response = await fetch("/api/messages/conversations", {
    method: "POST",
    headers: await authHeaders(getToken),
    body: JSON.stringify({ targetUid }),
  });

  const payload = await parseResponse<{ conversation: ConversationDetail }>(response);
  return payload.conversation;
}

export async function fetchConversations(
  getToken: () => Promise<string>,
): Promise<ConversationListItem[]> {
  const response = await fetch("/api/messages/conversations", {
    headers: { Authorization: `Bearer ${await getToken()}` },
    cache: "no-store",
  });

  const payload = await parseResponse<{ items: ConversationListItem[] }>(response);
  return payload.items;
}

export async function fetchConversation(
  getToken: () => Promise<string>,
  conversationId: string,
): Promise<ConversationDetail> {
  const response = await fetch(`/api/messages/conversations/${conversationId}`, {
    headers: { Authorization: `Bearer ${await getToken()}` },
    cache: "no-store",
  });

  const payload = await parseResponse<{ conversation: ConversationDetail }>(response);
  return payload.conversation;
}

export async function fetchMessageQuota(
  getToken: () => Promise<string>,
): Promise<MessageQuotaSummary> {
  const response = await fetch("/api/messages/quota", {
    headers: { Authorization: `Bearer ${await getToken()}` },
    cache: "no-store",
  });

  const payload = await parseResponse<{ quota: MessageQuotaSummary }>(response);
  return payload.quota;
}

export async function fetchMessages(
  getToken: () => Promise<string>,
  conversationId: string,
  options?: { limit?: number; beforeCreatedAt?: string },
): Promise<{ items: MessageItem[]; hasMore: boolean; nextCursorCreatedAt?: string }> {
  const params = new URLSearchParams();
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.beforeCreatedAt) params.set("beforeCreatedAt", options.beforeCreatedAt);

  const response = await fetch(
    `/api/messages/conversations/${conversationId}/messages${params.toString() ? `?${params}` : ""}`,
    {
      headers: { Authorization: `Bearer ${await getToken()}` },
      cache: "no-store",
    },
  );

  const payload = await parseResponse<{
    page: { items: MessageItem[]; hasMore: boolean; nextCursorCreatedAt?: string };
  }>(response);
  return payload.page;
}

export async function sendMessage(
  getToken: () => Promise<string>,
  input: { conversationId: string; body: string; idempotencyKey: string },
): Promise<{ message: MessageItem; quota: MessageQuotaSummary; created: boolean }> {
  const response = await fetch("/api/messages/send", {
    method: "POST",
    headers: await authHeaders(getToken),
    body: JSON.stringify(input),
  });

  const payload = await parseResponse<{
    result: { message: MessageItem; quota: MessageQuotaSummary; created: boolean };
  }>(response);

  return payload.result;
}

export async function markConversationRead(
  getToken: () => Promise<string>,
  conversationId: string,
  lastReadMessageId?: string,
): Promise<void> {
  const response = await fetch("/api/messages/read", {
    method: "POST",
    headers: await authHeaders(getToken),
    body: JSON.stringify({ conversationId, lastReadMessageId }),
  });

  await parseResponse(response);
}

export function subscribeToConversationMessages(
  conversationId: string,
  onUpdate: (messages: MessageItem[]) => void,
  pageSize = 30,
): Unsubscribe {
  if (!db) return () => {};

  const messagesQuery = query(
    collection(db, "conversations", conversationId, "messages"),
    orderBy("createdAt", "desc"),
    limit(pageSize),
  );

  return onSnapshot(messagesQuery, (snapshot) => {
    const items = snapshot.docs
      .map((docSnap) => {
        const data = docSnap.data() as {
          senderUid?: string;
          body?: string;
          messageType?: "text";
          createdAt?: Timestamp | null;
        };
        return {
          id: docSnap.id,
          senderUid: data.senderUid ?? "",
          body: data.body ?? "",
          messageType: data.messageType ?? "text",
          createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : undefined,
        } satisfies MessageItem;
      })
      .reverse();

    onUpdate(items);
  });
}
