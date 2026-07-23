"use client";

import Link from "next/link";
import { Avatar, Button, Card } from "@/components/ui";
import type { ConnectionListItem } from "@/lib/network/types";

interface ConnectionRequestCardProps {
  item: ConnectionListItem;
  mode: "incoming" | "sent";
  onAccept?: () => Promise<void>;
  onDecline?: () => Promise<void>;
  onCancel?: () => Promise<void>;
  loading?: boolean;
}

export default function ConnectionRequestCard({
  item,
  mode,
  onAccept,
  onDecline,
  onCancel,
  loading = false,
}: ConnectionRequestCardProps) {
  const other = item.otherUser;

  return (
    <Card className="space-y-3">
      <div className="flex items-start gap-3">
        <Avatar src={other?.photoURL ?? null} alt={other?.displayName ?? "Deleted account"} size="md" userId={other?.uid} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{other?.displayName ?? "Deleted account"}</p>
          <p className="truncate text-xs text-muted">
            {other?.professionalHeadline || other?.professionalRole || "Professional educator"}
          </p>
          {item.createdAt && <p className="mt-1 text-xs text-muted">Requested {new Date(item.createdAt).toLocaleDateString()}</p>}
        </div>
      </div>

      {mode === "incoming" && (item.reason || item.introMessage) && (
        <div className="rounded-lg border border-primary-100 bg-primary-50/50 p-3">
          {item.reason && <p className="text-xs font-medium text-primary-900">Reason: {item.reason.replace(/-/g, " ")}</p>}
          {item.introMessage && <p className="mt-1 text-sm text-primary-900">{item.introMessage}</p>}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {other?.uid && (
          <Link href={`/educators/${other.uid}`}>
            <Button variant="outline" size="sm">View Profile</Button>
          </Link>
        )}

        {mode === "incoming" ? (
          <>
            <Button size="sm" onClick={() => void onAccept?.()} isLoading={loading}>Accept</Button>
            <Button variant="outline" size="sm" onClick={() => void onDecline?.()} disabled={loading}>Decline</Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={() => void onCancel?.()} disabled={loading}>
            Cancel request
          </Button>
        )}
      </div>
    </Card>
  );
}
