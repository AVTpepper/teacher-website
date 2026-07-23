import {
  CONNECTION_REQUEST_REASONS,
  CONNECTION_STATUSES,
  FREE_MONTHLY_CONNECTION_REQUEST_LIMIT,
  MAX_CONNECTION_INTRO_MESSAGE_LENGTH,
} from "@/lib/network/constants";
import type { ConnectionRelationshipState, ConnectionRequestReason, ConnectionStatus } from "@/lib/network/types";

const STATUS_SET = new Set<string>(CONNECTION_STATUSES);
const REASON_SET = new Set<string>(CONNECTION_REQUEST_REASONS);

export function isConnectionStatus(value: string): value is ConnectionStatus {
  return STATUS_SET.has(value);
}

export function isConnectionReason(value: string): value is ConnectionRequestReason {
  return REASON_SET.has(value);
}

function ensureUid(uid: string): string {
  const trimmed = uid.trim();
  if (!trimmed) {
    throw new Error("Invalid uid.");
  }
  return trimmed;
}

function encodeUid(uid: string): string {
  return Buffer.from(uid, "utf8").toString("base64url");
}

export function canonicalParticipantIds(userAId: string, userBId: string): [string, string] {
  const a = ensureUid(userAId);
  const b = ensureUid(userBId);
  if (a === b) {
    throw new Error("Participant ids must be different.");
  }
  return a < b ? [a, b] : [b, a];
}

export function buildParticipantKey(userAId: string, userBId: string): string {
  const [left, right] = canonicalParticipantIds(userAId, userBId);
  return `${encodeUid(left)}.${encodeUid(right)}`;
}

export function getUtcMonthKey(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function normalizeConnectionReason(input: unknown): ConnectionRequestReason | undefined {
  if (typeof input !== "string") return undefined;
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return undefined;
  return isConnectionReason(trimmed) ? trimmed : undefined;
}

export function validateIntroMessage(input: unknown): { value?: string; error?: string } {
  if (typeof input !== "string") {
    return { value: undefined };
  }

  const normalized = input.replace(/\s+/g, " ").trim();
  if (!normalized) return { value: undefined };

  if (normalized.length > MAX_CONNECTION_INTRO_MESSAGE_LENGTH) {
    return {
      error: `Intro message must be ${MAX_CONNECTION_INTRO_MESSAGE_LENGTH} characters or fewer.`,
    };
  }

  if (/[<>]/.test(normalized)) {
    return {
      error: "Intro message cannot contain HTML-like markup.",
    };
  }

  return { value: normalized };
}

export function toRelationshipState(
  record: { status: ConnectionStatus; requesterId: string; recipientId: string } | null,
  currentUid: string,
): ConnectionRelationshipState {
  if (!record) return "none";

  if (record.status === "accepted") return "connected";
  if (record.status !== "pending") return "none";

  return record.requesterId === currentUid ? "outgoing-pending" : "incoming-pending";
}

export function isValidTransition(current: ConnectionStatus, next: ConnectionStatus): boolean {
  if (current === "pending") {
    return next === "accepted" || next === "declined" || next === "canceled";
  }
  if (current === "accepted") {
    return next === "removed";
  }
  return false;
}

export function normalizeTier(value: unknown): "free" | "plus" {
  return value === "plus" ? "plus" : "free";
}

export function evaluateConnectionQuota(params: {
  used: number;
  isUnlimited: boolean;
  limit?: number;
}): {
  limit: number | null;
  used: number;
  remaining: number | null;
  canSend: boolean;
} {
  if (params.isUnlimited) {
    return {
      limit: null,
      used: 0,
      remaining: null,
      canSend: true,
    };
  }

  const limit = params.limit ?? FREE_MONTHLY_CONNECTION_REQUEST_LIMIT;
  const used = Math.max(0, Math.floor(params.used));
  const remaining = Math.max(0, limit - used);

  return {
    limit,
    used,
    remaining,
    canSend: remaining > 0,
  };
}
