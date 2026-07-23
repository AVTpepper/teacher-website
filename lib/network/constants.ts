export const FREE_MONTHLY_CONNECTION_REQUEST_LIMIT = 5;
export const MAX_CONNECTION_INTRO_MESSAGE_LENGTH = 280;

export const CONNECTION_REQUEST_REASONS = [
  "similar-subjects",
  "same-curriculum",
  "collaborate",
  "exchange-resources",
  "learn-from-you",
  "network",
  "other",
] as const;

export const CONNECTION_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "canceled",
  "removed",
] as const;

export const NETWORK_TABS = [
  "connections",
  "requests",
  "sent",
  "following",
  "followers",
] as const;
