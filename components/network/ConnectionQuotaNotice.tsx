"use client";

import Link from "next/link";
import type { ConnectionQuotaSummary } from "@/lib/network/types";

export default function ConnectionQuotaNotice({ quota }: { quota: ConnectionQuotaSummary | null }) {
  if (!quota || quota.isUnlimited || quota.limit === null || quota.remaining === null) {
    return null;
  }

  const used = Math.max(0, quota.limit - quota.remaining);

  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted">
      <p>
        {quota.remaining} of {quota.limit} connection requests remaining this month.
      </p>
      {quota.remaining <= 0 && (
        <p className="mt-1 text-xs text-muted">
          You reached this month&apos;s free limit. <Link href="/account/upgrade" className="text-primary-900 underline">Upgrade to Plus</Link> for unlimited requests.
        </p>
      )}
      {quota.remaining > 0 && (
        <p className="sr-only">{used} requests used this month.</p>
      )}
    </div>
  );
}
