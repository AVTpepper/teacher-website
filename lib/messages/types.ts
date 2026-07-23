import type { MESSAGE_CONVERSATION_STATUSES, MESSAGE_TYPE_VALUES } from "@/lib/messages/constants";

export type MessageConversationStatus = (typeof MESSAGE_CONVERSATION_STATUSES)[number];
export type MessageType = (typeof MESSAGE_TYPE_VALUES)[number];

export interface MessageUserSummary {
  uid: string;
  displayName: string;
  photoURL: string | null;
  professionalHeadline?: string;
  professionalRole?: string;
}

export interface MessageConversationRecord {
  id: string;
  conversationId: string;
  participantIds: string[];
  participantKey: string;
  createdBy: string;
  createdAt: unknown;
  updatedAt: unknown;
  lastMessageAt?: unknown;
  lastMessagePreview?: string;
  lastMessageSenderUid?: string;
  unreadBy?: Record<string, number>;
  lastReadAtBy?: Record<string, unknown>;
  lastReadMessageIdBy?: Record<string, string | null>;
  status: MessageConversationStatus;
}

export interface MessageRecord {
  id: string;
  senderUid: string;
  body: string;
  createdAt: unknown;
  messageType: MessageType;
  idempotencyKey: string;
}

export interface MessageQuotaSummary {
  periodKey: string;
  isUnlimited: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
  canSend: boolean;
}

export interface ConversationListItem {
  conversationId: string;
  participantKey: string;
  status: MessageConversationStatus;
  otherUser: MessageUserSummary | null;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  lastMessageSenderUid?: string;
  unreadCount: number;
  canSend: boolean;
  createdAt?: string;
}

export interface ConversationDetail {
  conversationId: string;
  participantKey: string;
  status: MessageConversationStatus;
  participants: MessageUserSummary[];
  otherUser: MessageUserSummary | null;
  canSend: boolean;
  unreadCount: number;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  lastMessageSenderUid?: string;
  createdAt?: string;
}

export interface MessageItem {
  id: string;
  senderUid: string;
  body: string;
  createdAt?: string;
  messageType: MessageType;
}
