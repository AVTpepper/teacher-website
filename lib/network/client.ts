import type {
  ConnectionListItem,
  ConnectionQuotaSummary,
  ConnectionRelationshipState,
  ConnectionRequestReason,
} from "@/lib/network/types";

export interface ConnectionStatusPayload {
  participantKey: string;
  status: ConnectionRelationshipState;
}

export class ConnectionClientError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "ConnectionClientError";
    this.code = code;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
  } & T;

  if (!response.ok) {
    throw new ConnectionClientError(payload.error ?? "Request failed.", payload.code);
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

export async function fetchConnectionStatuses(
  getToken: () => Promise<string>,
  targetUids: string[],
): Promise<Record<string, ConnectionStatusPayload>> {
  if (targetUids.length === 0) return {};
  const ids = Array.from(new Set(targetUids.map((id) => id.trim()).filter(Boolean))).join(",");

  const response = await fetch(`/api/network/status?ids=${encodeURIComponent(ids)}`, {
    headers: {
      Authorization: `Bearer ${await getToken()}`,
    },
    cache: "no-store",
  });

  const payload = await parseResponse<{ statuses: Record<string, ConnectionStatusPayload> }>(response);
  return payload.statuses;
}

export async function sendConnectionRequest(
  getToken: () => Promise<string>,
  input: { recipientId: string; reason?: ConnectionRequestReason; introMessage?: string },
): Promise<ConnectionStatusPayload> {
  const response = await fetch("/api/network/requests", {
    method: "POST",
    headers: await authHeaders(getToken),
    body: JSON.stringify(input),
  });

  const payload = await parseResponse<{ result: { participantKey: string; state: ConnectionRelationshipState } }>(
    response,
  );

  return {
    participantKey: payload.result.participantKey,
    status: payload.result.state,
  };
}

export async function acceptConnectionRequest(
  getToken: () => Promise<string>,
  participantKey: string,
): Promise<void> {
  const response = await fetch(`/api/network/requests/${participantKey}/accept`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await getToken()}` },
  });
  await parseResponse(response);
}

export async function declineConnectionRequest(
  getToken: () => Promise<string>,
  participantKey: string,
): Promise<void> {
  const response = await fetch(`/api/network/requests/${participantKey}/decline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await getToken()}` },
  });
  await parseResponse(response);
}

export async function cancelConnectionRequest(
  getToken: () => Promise<string>,
  participantKey: string,
): Promise<void> {
  const response = await fetch(`/api/network/requests/${participantKey}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await getToken()}` },
  });
  await parseResponse(response);
}

export async function removeConnection(
  getToken: () => Promise<string>,
  participantKey: string,
): Promise<void> {
  const response = await fetch(`/api/network/connections/${participantKey}/remove`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await getToken()}` },
  });
  await parseResponse(response);
}

export async function fetchIncomingRequests(
  getToken: () => Promise<string>,
): Promise<ConnectionListItem[]> {
  const response = await fetch("/api/network/requests?kind=incoming", {
    headers: { Authorization: `Bearer ${await getToken()}` },
    cache: "no-store",
  });
  const payload = await parseResponse<{ items: ConnectionListItem[] }>(response);
  return payload.items;
}

export async function fetchSentRequests(getToken: () => Promise<string>): Promise<ConnectionListItem[]> {
  const response = await fetch("/api/network/requests?kind=sent", {
    headers: { Authorization: `Bearer ${await getToken()}` },
    cache: "no-store",
  });
  const payload = await parseResponse<{ items: ConnectionListItem[] }>(response);
  return payload.items;
}

export async function fetchAcceptedConnections(
  getToken: () => Promise<string>,
): Promise<ConnectionListItem[]> {
  const response = await fetch("/api/network/connections", {
    headers: { Authorization: `Bearer ${await getToken()}` },
    cache: "no-store",
  });
  const payload = await parseResponse<{ items: ConnectionListItem[] }>(response);
  return payload.items;
}

export async function fetchConnectionQuota(
  getToken: () => Promise<string>,
): Promise<ConnectionQuotaSummary> {
  const response = await fetch("/api/network/quota", {
    headers: { Authorization: `Bearer ${await getToken()}` },
    cache: "no-store",
  });
  const payload = await parseResponse<{ quota: ConnectionQuotaSummary }>(response);
  return payload.quota;
}

export async function fetchNetworkSummary(
  getToken: () => Promise<string>,
): Promise<{ connections: number; incoming: number; sent: number; quota: ConnectionQuotaSummary }> {
  const response = await fetch("/api/network/summary", {
    headers: { Authorization: `Bearer ${await getToken()}` },
    cache: "no-store",
  });
  const payload = await parseResponse<{
    summary: { connections: number; incoming: number; sent: number; quota: ConnectionQuotaSummary };
  }>(response);
  return payload.summary;
}
