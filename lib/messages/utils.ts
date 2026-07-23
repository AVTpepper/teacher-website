import {
  FREE_MONTHLY_SENT_MESSAGE_LIMIT,
  MAX_IDEMPOTENCY_KEY_LENGTH,
  MAX_MESSAGE_BODY_LENGTH,
  MIN_IDEMPOTENCY_KEY_LENGTH,
} from "@/lib/messages/constants";
import { getUtcMonthKey } from "@/lib/network/utils";

const IDEMPOTENCY_KEY_REGEX = /^[A-Za-z0-9_-]+$/;

export function normalizeMessageBody(input: unknown): { value?: string; error?: string } {
  if (typeof input !== "string") {
    return { error: "Message body is required." };
  }

  const normalized = input.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return { error: "Message body is required." };
  }

  if (normalized.length > MAX_MESSAGE_BODY_LENGTH) {
    return { error: `Message body must be ${MAX_MESSAGE_BODY_LENGTH} characters or fewer.` };
  }

  if (/[<>]/.test(normalized)) {
    return { error: "Message body cannot contain HTML-like markup." };
  }

  return { value: normalized };
}

export function normalizeIdempotencyKey(input: unknown): { value?: string; error?: string } {
  if (typeof input !== "string") {
    return { error: "Idempotency key is required." };
  }

  const normalized = input.trim();
  if (!normalized) {
    return { error: "Idempotency key is required." };
  }

  if (
    normalized.length < MIN_IDEMPOTENCY_KEY_LENGTH
    || normalized.length > MAX_IDEMPOTENCY_KEY_LENGTH
  ) {
    return {
      error: `Idempotency key must be ${MIN_IDEMPOTENCY_KEY_LENGTH}-${MAX_IDEMPOTENCY_KEY_LENGTH} characters.`,
    };
  }

  if (!IDEMPOTENCY_KEY_REGEX.test(normalized)) {
    return { error: "Idempotency key must use only letters, numbers, underscore, or dash." };
  }

  return { value: normalized };
}

export function buildMessagePreview(body: string): string {
  const singleLine = body.replace(/\s+/g, " ").trim();
  if (singleLine.length <= 120) return singleLine;
  return `${singleLine.slice(0, 117)}...`;
}

export function evaluateMessageQuota(params: {
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

  const limit = params.limit ?? FREE_MONTHLY_SENT_MESSAGE_LIMIT;
  const used = Math.max(0, Math.floor(params.used));
  const remaining = Math.max(0, limit - used);

  return {
    limit,
    used,
    remaining,
    canSend: remaining > 0,
  };
}

export { getUtcMonthKey };
