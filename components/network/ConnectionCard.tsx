"use client";

import Link from "next/link";
import { Avatar, Button, Card } from "@/components/ui";
import type { ConnectionListItem } from "@/lib/network/types";

export default function ConnectionCard({
  item,
  onRemove,
  removing,
  onMessage,
  messaging,
}: {
  item: ConnectionListItem;
  onRemove: () => void;
  removing: boolean;
  onMessage?: () => void;
  messaging?: boolean;
}) {
  const other = item.otherUser;

  return (
    <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Avatar src={other?.photoURL ?? null} alt={other?.displayName ?? "Deleted account"} size="md" userId={other?.uid} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{other?.displayName ?? "Deleted account"}</p>
          <p className="truncate text-xs text-muted">
            {other?.professionalHeadline || other?.professionalRole || "Professional educator"}
          </p>
          {(other?.city || other?.country) && (
            <p className="mt-1 text-xs text-muted">{other?.city ? `${other.city}, ` : ""}{other?.country}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {other?.uid && (
          <Link href={`/educators/${other.uid}`}>
            <Button variant="outline" size="sm">View Profile</Button>
          </Link>
        )}
        {other?.uid && onMessage && (
          <Button variant="secondary" size="sm" onClick={onMessage} isLoading={Boolean(messaging)}>
            Message
          </Button>
        )}
        <Button variant="destructive" size="sm" onClick={onRemove} isLoading={removing}>
          Remove Connection
        </Button>
      </div>
    </Card>
  );
}
