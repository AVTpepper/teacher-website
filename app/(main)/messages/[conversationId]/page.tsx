"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Button, Card, ErrorState, Textarea } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import {
  MessageClientError,
  fetchConversation,
  fetchMessageQuota,
  fetchMessages,
  markConversationRead,
  sendMessage,
  subscribeToConversationMessages,
} from "@/lib/messages/client";
import type { ConversationDetail, MessageItem, MessageQuotaSummary } from "@/lib/messages/types";

function mergeMessages(current: MessageItem[], incoming: MessageItem[]): MessageItem[] {
  const map = new Map<string, MessageItem>();

  [...current, ...incoming].forEach((message) => {
    map.set(message.id, message);
  });

  return Array.from(map.values()).sort((a, b) => {
    const left = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const right = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (left !== right) return left - right;
    return a.id.localeCompare(b.id);
  });
}

function buildIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
}

function formatTimestamp(value?: string): string {
  if (!value) return "Sending...";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sending...";
  return date.toLocaleString();
}

export default function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [conversationId, setConversationId] = useState<string>("");
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [quota, setQuota] = useState<MessageQuotaSummary | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composeValue, setComposeValue] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [oldestCursor, setOldestCursor] = useState<string | undefined>(undefined);

  useEffect(() => {
    params.then((resolved) => setConversationId(resolved.conversationId)).catch(() => setConversationId(""));
  }, [params]);

  const canSend = useMemo(() => {
    if (!conversation?.canSend) return false;
    if (!quota) return true;
    return quota.canSend;
  }, [conversation?.canSend, quota]);

  const refreshConversation = useCallback(async () => {
    if (!user || !conversationId) return;

    const tokenProvider = () => user.getIdToken();
    const [conversationData, messagesPage, quotaData] = await Promise.all([
      fetchConversation(tokenProvider, conversationId),
      fetchMessages(tokenProvider, conversationId, { limit: 30 }),
      fetchMessageQuota(tokenProvider),
    ]);

    setConversation(conversationData);
    setMessages(messagesPage.items.slice().reverse());
    setHasMore(messagesPage.hasMore);
    setOldestCursor(messagesPage.nextCursorCreatedAt);
    setQuota(quotaData);

    const newestMessage = messagesPage.items[0];
    await markConversationRead(tokenProvider, conversationId, newestMessage?.id);
  }, [conversationId, user]);

  useEffect(() => {
    if (!authLoading && !user) {
      const redirect = conversationId ? `/messages/${conversationId}` : "/messages";
      router.replace(`/auth/login?redirect=${encodeURIComponent(redirect)}`);
      return;
    }

    if (!authLoading && user && conversationId) {
      setLoading(true);
      setError(null);

      refreshConversation()
        .catch((loadError) => {
          setConversation(null);
          setMessages([]);
          setQuota(null);
          if (loadError instanceof MessageClientError && loadError.code === "PERMISSION_DENIED") {
            setError("You do not have access to this conversation.");
            return;
          }
          setError("We could not load this conversation right now. Please try again.");
        })
        .finally(() => setLoading(false));
    }
  }, [authLoading, conversationId, refreshConversation, router, user]);

  useEffect(() => {
    if (!user || !conversationId) return;

    const unsub = subscribeToConversationMessages(conversationId, (liveMessages) => {
      setMessages((current) => mergeMessages(current, liveMessages));
    });

    return unsub;
  }, [conversationId, user]);

  useEffect(() => {
    if (!user || !conversationId || messages.length === 0) return;
    const newest = messages[messages.length - 1];
    if (!newest || newest.senderUid === user.uid) return;
    markConversationRead(() => user.getIdToken(), conversationId, newest.id).catch(() => {});
  }, [conversationId, messages, user]);

  async function handleLoadOlder() {
    if (!user || !conversationId || !oldestCursor || loadingOlder || !hasMore) return;

    setLoadingOlder(true);
    try {
      const page = await fetchMessages(() => user.getIdToken(), conversationId, {
        limit: 30,
        beforeCreatedAt: oldestCursor,
      });

      setMessages((current) => mergeMessages(page.items.slice().reverse(), current));
      setHasMore(page.hasMore);
      setOldestCursor(page.nextCursorCreatedAt);
    } catch {
      setSendError("Could not load older messages right now.");
    } finally {
      setLoadingOlder(false);
    }
  }

  async function handleSendMessage() {
    if (!user || !conversationId || !canSend || sending) return;

    setSending(true);
    setSendError(null);
    const tokenProvider = () => user.getIdToken();

    try {
      const result = await sendMessage(tokenProvider, {
        conversationId,
        body: composeValue,
        idempotencyKey: buildIdempotencyKey(),
      });

      setComposeValue("");
      setQuota(result.quota);
      setMessages((current) => mergeMessages(current, [result.message]));
      await markConversationRead(tokenProvider, conversationId, result.message.id);
    } catch (sendErr) {
      if (sendErr instanceof MessageClientError && sendErr.code === "MONTHLY_LIMIT_REACHED") {
        setQuota((current) => {
          if (!current) return current;
          return {
            ...current,
            canSend: false,
            remaining: 0,
          };
        });
      }
      setSendError(sendErr instanceof Error ? sendErr.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => {
          if (!conversationId) return;
          void refreshConversation();
        }}
      />
    );
  }

  if (!conversation) return null;

  return (
    <div className="space-y-4 pb-8">
      <Card className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar
            src={conversation.otherUser?.photoURL ?? null}
            alt={conversation.otherUser?.displayName ?? "Deleted account"}
            size="md"
            userId={conversation.otherUser?.uid}
          />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-foreground">
              {conversation.otherUser?.displayName ?? "Deleted account"}
            </h1>
            <p className="truncate text-xs text-muted">
              {conversation.otherUser?.professionalHeadline
                || conversation.otherUser?.professionalRole
                || "Professional educator"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/messages">
            <Button variant="outline" size="sm">Back to Messages</Button>
          </Link>
          {conversation.otherUser?.uid && (
            <Link href={`/educators/${conversation.otherUser.uid}`}>
              <Button variant="outline" size="sm">View Profile</Button>
            </Link>
          )}
        </div>
      </Card>

      {!conversation.canSend && (
        <Card className="border-warning-200 bg-warning-50 text-warning-900">
          This thread is read-only because this connection is no longer active.
        </Card>
      )}

      {quota && !quota.isUnlimited && !quota.canSend && (
        <Card className="border-warning-200 bg-warning-50 text-warning-900">
          You reached your monthly free message limit. Upgrade to Plus for unlimited messaging.
        </Card>
      )}

      <Card className="space-y-3">
        {hasMore && (
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={handleLoadOlder} disabled={loadingOlder}>
              {loadingOlder ? "Loading..." : "Load older messages"}
            </Button>
          </div>
        )}

        <div className="max-h-[55vh] space-y-2 overflow-y-auto" aria-live="polite">
          {messages.map((message) => {
            const isMine = message.senderUid === user.uid;
            return (
              <div
                key={message.id}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    isMine
                      ? "bg-primary-700 text-white"
                      : "bg-secondary-100 text-secondary-900"
                  }`}
                >
                  <p className="whitespace-pre-wrap wrap-break-word">{message.body}</p>
                  <p className={`mt-1 text-[11px] ${isMine ? "text-white/80" : "text-secondary-600"}`}>
                    {formatTimestamp(message.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
          {messages.length === 0 && (
            <p className="py-10 text-center text-sm text-muted">
              Start the conversation.
            </p>
          )}
        </div>
      </Card>

      <Card>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSendMessage();
          }}
        >
          <Textarea
            label="Message"
            value={composeValue}
            onChange={(event) => setComposeValue(event.target.value)}
            placeholder={canSend ? "Write a message" : "Messaging is unavailable for this conversation."}
            disabled={!canSend || sending}
            maxLength={1200}
            showCharacterCount
          />
          {sendError && (
            <p role="alert" className="text-sm text-error-600">{sendError}</p>
          )}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={!canSend || sending || composeValue.trim().length === 0}
              isLoading={sending}
            >
              Send message
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
