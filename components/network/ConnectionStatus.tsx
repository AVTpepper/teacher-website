"use client";

import type { ConnectionRelationshipState } from "@/lib/network/types";

const LABELS: Record<ConnectionRelationshipState, string> = {
  none: "Not connected",
  "outgoing-pending": "Request sent",
  "incoming-pending": "Respond to request",
  connected: "Connected",
};

export default function ConnectionStatus({
  state,
  className = "",
}: {
  state: ConnectionRelationshipState;
  className?: string;
}) {
  return (
    <p className={`text-xs font-medium text-muted ${className}`} aria-live="polite">
      {LABELS[state]}
    </p>
  );
}
