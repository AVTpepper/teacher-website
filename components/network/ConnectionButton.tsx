"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui";
import ConnectionRequestDialog from "@/components/network/ConnectionRequestDialog";
import type {
  ConnectionQuotaSummary,
  ConnectionRelationshipState,
  ConnectionRequestReason,
} from "@/lib/network/types";

interface ConnectionButtonProps {
  targetDisplayName: string;
  relationshipState: ConnectionRelationshipState;
  quota: ConnectionQuotaSummary | null;
  loading?: boolean;
  disabled?: boolean;
  onSendRequest: (payload: { reason?: ConnectionRequestReason; introMessage?: string }) => Promise<void>;
  onRespond?: () => void;
}

export default function ConnectionButton({
  targetDisplayName,
  relationshipState,
  quota,
  loading = false,
  disabled = false,
  onSendRequest,
  onRespond,
}: ConnectionButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const limitReached = useMemo(() => {
    if (!quota || quota.isUnlimited || quota.remaining === null) return false;
    return quota.remaining <= 0;
  }, [quota]);

  async function handleSubmit(payload: { reason?: ConnectionRequestReason; introMessage?: string }) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSendRequest(payload);
      setDialogOpen(false);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to send request.");
    } finally {
      setSubmitting(false);
    }
  }

  if (relationshipState === "connected") {
    return (
      <Button variant="outline" size="sm" disabled aria-label={`Connected with ${targetDisplayName}`}>
        Connected
      </Button>
    );
  }

  if (relationshipState === "outgoing-pending") {
    return (
      <Button variant="outline" size="sm" disabled aria-label={`Connection request sent to ${targetDisplayName}`}>
        Request sent
      </Button>
    );
  }

  if (relationshipState === "incoming-pending") {
    return (
      <Button
        variant="secondary"
        size="sm"
        onClick={onRespond}
        disabled={disabled}
        aria-label={`Respond to ${targetDisplayName} connection request`}
      >
        Respond
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setDialogOpen(true)}
        disabled={disabled || loading || limitReached}
        aria-label={limitReached ? "Monthly connection request limit reached" : `Connect with ${targetDisplayName}`}
      >
        {loading ? "Sending..." : limitReached ? "Limit reached" : "Connect"}
      </Button>
      <ConnectionRequestDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        isSubmitting={submitting}
        submitError={submitError}
      />
    </>
  );
}
