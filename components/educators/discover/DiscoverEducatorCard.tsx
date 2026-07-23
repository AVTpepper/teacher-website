"use client";

import Link from "next/link";
import { Avatar, Badge, Button, Card } from "@/components/ui";
import ConnectionButton from "@/components/network/ConnectionButton";
import type { UserProfile } from "@/lib/firestore/users";
import type { ConnectionQuotaSummary, ConnectionRelationshipState, ConnectionRequestReason } from "@/lib/network/types";

interface DiscoverEducatorCardProps {
  educator: UserProfile;
  isOwnProfile: boolean;
  isFollowed: boolean;
  followLoading: boolean;
  connectionState: ConnectionRelationshipState;
  connectionLoading: boolean;
  connectionQuota: ConnectionQuotaSummary | null;
  reasons?: string[];
  onToggleFollow: (educator: UserProfile) => void;
  onSendConnectionRequest: (
    educator: UserProfile,
    payload: { reason?: ConnectionRequestReason; introMessage?: string },
  ) => Promise<void>;
  onRespondToConnectionRequest: (educator: UserProfile) => void;
}

function compactList(values: string[] | undefined, max = 3): { visible: string[]; overflow: number } {
  const cleaned = (values ?? []).map((value) => value.trim()).filter(Boolean);
  const visible = cleaned.slice(0, max);
  return {
    visible,
    overflow: Math.max(0, cleaned.length - visible.length),
  };
}

function gradeSummary(profile: UserProfile): string[] {
  const values = [...(profile.gradeLevels ?? [])];
  if (profile.gradeLevel && !values.includes(profile.gradeLevel)) {
    values.push(profile.gradeLevel);
  }
  return values.filter(Boolean);
}

export default function DiscoverEducatorCard({
  educator,
  isOwnProfile,
  isFollowed,
  followLoading,
  connectionState,
  connectionLoading,
  connectionQuota,
  reasons,
  onToggleFollow,
  onSendConnectionRequest,
  onRespondToConnectionRequest,
}: DiscoverEducatorCardProps) {
  const subjects = compactList(educator.subjects, 3);
  const gradeLevels = compactList(gradeSummary(educator), 2);
  const curricula = compactList(educator.curricula, 2);
  const interests = compactList(educator.professionalInterests, 2);

  return (
    <Card className="flex h-full flex-col justify-between">
      <div>
        <div className="flex items-start gap-3">
          <Avatar src={educator.photoURL} alt={educator.displayName} size="lg" userId={educator.uid} showPlusBadge isPlus={educator.tier === "plus"} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="truncate text-base font-semibold text-foreground">{educator.displayName}</h3>
              {educator.isVerified && <Badge variant="success">Verified</Badge>}
            </div>
            <p className="mt-0.5 line-clamp-2 text-sm text-muted">
              {educator.professionalHeadline?.trim() || educator.professionalRole || "Professional educator"}
            </p>
            {educator.professionalRole && educator.professionalHeadline && (
              <p className="mt-0.5 text-xs text-muted">{educator.professionalRole}</p>
            )}
            {(educator.country || educator.city) && (
              <p className="mt-1 text-xs text-muted">
                {educator.city ? `${educator.city}, ` : ""}{educator.country}
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {(subjects.visible.length > 0 || subjects.overflow > 0) && (
            <TagRow label="Subjects" values={subjects.visible} overflow={subjects.overflow} />
          )}
          {(gradeLevels.visible.length > 0 || gradeLevels.overflow > 0) && (
            <TagRow label="Grade Levels" values={gradeLevels.visible} overflow={gradeLevels.overflow} />
          )}
          {(curricula.visible.length > 0 || curricula.overflow > 0) && (
            <TagRow label="Curriculum" values={curricula.visible} overflow={curricula.overflow} />
          )}
          {(interests.visible.length > 0 || interests.overflow > 0) && (
            <TagRow label="Interests" values={interests.visible} overflow={interests.overflow} />
          )}
        </div>

        {reasons && reasons.length > 0 && (
          <div className="mt-3 rounded-lg border border-primary-100 bg-primary-50/60 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-900">Why this educator may be relevant</p>
            <ul className="mt-1 space-y-1">
              {reasons.slice(0, 2).map((reason) => (
                <li key={reason} className="text-xs text-primary-900">
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Link href={`/educators/${educator.uid}`} className="flex-1">
          <Button variant="primary" size="sm" className="w-full">View Profile</Button>
        </Link>

        {!isOwnProfile && (
          <ConnectionButton
            targetDisplayName={educator.displayName}
            relationshipState={connectionState}
            quota={connectionQuota}
            loading={connectionLoading}
            onSendRequest={(payload) => onSendConnectionRequest(educator, payload)}
            onRespond={() => onRespondToConnectionRequest(educator)}
          />
        )}

        {!isOwnProfile && (
          <Button
            variant={isFollowed ? "outline" : "ghost"}
            size="sm"
            className="min-w-24"
            isLoading={followLoading}
            onClick={() => onToggleFollow(educator)}
          >
            {isFollowed ? "Following" : "Follow"}
          </Button>
        )}
      </div>
    </Card>
  );
}

function TagRow({
  label,
  values,
  overflow,
}: {
  label: string;
  values: string[];
  overflow: number;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {values.map((value) => (
          <Badge key={value} variant="default">{value}</Badge>
        ))}
        {overflow > 0 && <Badge variant="default">+{overflow}</Badge>}
      </div>
    </div>
  );
}
