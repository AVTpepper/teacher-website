import type { CONNECTION_REQUEST_REASONS, CONNECTION_STATUSES } from "@/lib/network/constants";

export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export type ConnectionRequestReason = (typeof CONNECTION_REQUEST_REASONS)[number];

export interface ConnectionRecord {
  id: string;
  participantKey: string;
  participantIds: [string, string];
  requesterId: string;
  recipientId: string;
  status: ConnectionStatus;
  reason?: ConnectionRequestReason;
  introMessage?: string;
  createdAt: unknown;
  updatedAt: unknown;
  acceptedAt?: unknown;
  declinedAt?: unknown;
  canceledAt?: unknown;
  removedAt?: unknown;
}

export type ConnectionRelationshipState =
  | "none"
  | "outgoing-pending"
  | "incoming-pending"
  | "connected";

export interface ConnectionQuotaSummary {
  periodKey: string;
  isUnlimited: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
  canSend: boolean;
}

export interface ConnectionUserSummary {
  uid: string;
  displayName: string;
  photoURL: string | null;
  professionalHeadline?: string;
  professionalRole?: string;
  country?: string;
  city?: string;
}

export interface ConnectionListItem {
  participantKey: string;
  status: ConnectionStatus;
  requesterId: string;
  recipientId: string;
  reason?: ConnectionRequestReason;
  introMessage?: string;
  updatedAt?: string;
  createdAt?: string;
  acceptedAt?: string;
  declinedAt?: string;
  canceledAt?: string;
  removedAt?: string;
  otherUser: ConnectionUserSummary | null;
}
