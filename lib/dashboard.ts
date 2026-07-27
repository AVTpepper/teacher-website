import type { ConnectionQuotaSummary } from "@/lib/network/types";
import type { MessageQuotaSummary } from "@/lib/messages/types";

export type DashboardVariant = "new-user" | "developing-network" | "established-user";

export type DashboardSectionId =
  | "attention"
  | "activation"
  | "recommendations"
  | "conversations"
  | "network-summary"
  | "network-activity"
  | "communities"
  | "resources"
  | "jobs"
  | "profile-completion"
  | "quick-actions"
  | "community-feed";

export interface DashboardProfileSnapshot {
  minimumComplete: boolean;
  percentage: number;
  missingRecommended: string[];
}

export interface DashboardCounts {
  connections: number;
  incomingRequests: number;
  sentRequests: number;
  unreadConversations: number;
  followers: number;
  following: number;
}

export interface DashboardAttentionInput {
  profile: DashboardProfileSnapshot;
  counts: DashboardCounts;
  connectionQuota: ConnectionQuotaSummary | null;
  messageQuota: MessageQuotaSummary | null;
}

export interface DashboardAttentionItem {
  id: string;
  title: string;
  description: string;
  count?: number;
  href: string;
  cta: string;
}

export interface DashboardActivationTask {
  id: string;
  label: string;
  completed: boolean;
  href: string;
  cta: string;
}

export interface DashboardUsageSummaryInput {
  connectionQuota: ConnectionQuotaSummary | null;
  messageQuota: MessageQuotaSummary | null;
  tier: "free" | "plus";
}

export interface DashboardModuleStateInput {
  loading: boolean;
  error: boolean;
  items: number;
}

export function getFirstName(displayName: string | null | undefined): string {
  const name = (displayName ?? "").trim();
  if (!name) return "there";
  return name.split(/\s+/)[0] ?? name;
}

export function classifyDashboardVariant(input: {
  profile: DashboardProfileSnapshot;
  counts: DashboardCounts;
}): DashboardVariant {
  const { profile, counts } = input;
  const hasNetworkActivity =
    counts.connections > 0 ||
    counts.incomingRequests > 0 ||
    counts.unreadConversations > 0 ||
    counts.following > 0 ||
    counts.followers > 0;

  if (!profile.minimumComplete || (!hasNetworkActivity && profile.percentage < 70)) {
    return "new-user";
  }

  if (counts.connections >= 2 || counts.incomingRequests > 0 || counts.unreadConversations > 0) {
    return "established-user";
  }

  return "developing-network";
}

export function buildAttentionItems(input: DashboardAttentionInput): DashboardAttentionItem[] {
  const items: DashboardAttentionItem[] = [];

  if (input.counts.incomingRequests > 0) {
    items.push({
      id: "connection-requests",
      title: "Connection requests",
      description:
        input.counts.incomingRequests === 1
          ? "1 educator would like to connect."
          : `${input.counts.incomingRequests} educators would like to connect.`,
      count: input.counts.incomingRequests,
      href: "/network?tab=requests",
      cta: "Review Requests",
    });
  }

  if (input.counts.unreadConversations > 0) {
    items.push({
      id: "unread-messages",
      title: "Unread conversations",
      description:
        input.counts.unreadConversations === 1
          ? "You have 1 unread conversation."
          : `You have ${input.counts.unreadConversations} unread conversations.`,
      count: input.counts.unreadConversations,
      href: "/messages",
      cta: "Open Messages",
    });
  }

  if (!input.profile.minimumComplete) {
    items.push({
      id: "incomplete-profile",
      title: "Incomplete profile",
      description: "Add your curriculum and professional interests to improve who discovers you.",
      href: "/profile/edit",
      cta: "Complete Profile",
    });
  }

  const connectionLow = input.connectionQuota?.remaining;
  if (typeof connectionLow === "number" && !input.connectionQuota?.isUnlimited && connectionLow <= 1) {
    items.push({
      id: "connection-usage",
      title: "Connection requests running low",
      description:
        connectionLow === 0
          ? "You’ve reached this month’s Free networking limit."
          : `Only ${connectionLow} connection request remains this month.`,
      count: connectionLow,
      href: "/network",
      cta: connectionLow === 0 ? "Open Network" : "View Network",
    });
  }

  const messageLow = input.messageQuota?.remaining;
  if (typeof messageLow === "number" && !input.messageQuota?.isUnlimited && messageLow <= 1) {
    items.push({
      id: "message-usage",
      title: "Messages running low",
      description:
        messageLow === 0
          ? "You’ve reached this month’s Free messaging limit."
          : `Only ${messageLow} message remains this month.`,
      count: messageLow,
      href: "/messages",
      cta: "Open Messages",
    });
  }

  return items;
}

export function buildActivationTasks(input: {
  profile: DashboardProfileSnapshot;
  counts: DashboardCounts;
  hasRecommendations: boolean;
  hasCommunities: boolean;
}): DashboardActivationTask[] {
  return [
    {
      id: "profile",
      label: "Complete your professional profile",
      completed: input.profile.minimumComplete,
      href: "/profile/edit",
      cta: "Edit Profile",
    },
    {
      id: "discover",
      label: "Discover relevant educators",
      completed: input.hasRecommendations,
      href: "/discover",
      cta: "Open Discover",
    },
    {
      id: "follow",
      label: "Follow an educator",
      completed: input.counts.following > 0,
      href: "/discover",
      cta: "Discover Educators",
    },
    {
      id: "connect",
      label: "Send a connection request",
      completed: input.counts.connections > 0 || input.counts.incomingRequests > 0 || input.counts.sentRequests > 0,
      href: "/discover",
      cta: "Find Connections",
    },
    {
      id: "community",
      label: "Explore a community discussion",
      completed: input.hasCommunities,
      href: "/forums",
      cta: "Explore Communities",
    },
  ];
}

export function classifyDashboardSectionOrder(variant: DashboardVariant): DashboardSectionId[] {
  if (variant === "new-user") {
    return [
      "attention",
      "activation",
      "recommendations",
      "profile-completion",
      "communities",
      "resources",
      "jobs",
      "community-feed",
      "quick-actions",
    ];
  }

  if (variant === "developing-network") {
    return [
      "attention",
      "recommendations",
      "conversations",
      "network-summary",
      "network-activity",
      "communities",
      "resources",
      "jobs",
      "profile-completion",
      "community-feed",
      "quick-actions",
    ];
  }

  return [
    "attention",
    "recommendations",
    "conversations",
    "network-summary",
    "network-activity",
    "communities",
    "resources",
    "jobs",
    "profile-completion",
    "community-feed",
    "quick-actions",
  ];
}

export function formatUsageSummary(input: DashboardUsageSummaryInput): string {
  if (input.tier === "plus") {
    return "Plus access active";
  }

  const pieces: string[] = [];

  if (input.connectionQuota) {
    if (input.connectionQuota.remaining === 0) {
      pieces.push("0 connection requests remaining");
    } else if (typeof input.connectionQuota.remaining === "number") {
      pieces.push(`${input.connectionQuota.remaining} connection request${input.connectionQuota.remaining === 1 ? "" : "s"} remaining`);
    }
  }

  if (input.messageQuota) {
    if (input.messageQuota.remaining === 0) {
      pieces.push("0 messages remaining");
    } else if (typeof input.messageQuota.remaining === "number") {
      pieces.push(`${input.messageQuota.remaining} message${input.messageQuota.remaining === 1 ? "" : "s"} remaining`);
    }
  }

  if (pieces.length === 0) {
    return "Usage data unavailable";
  }

  if (pieces.length === 1) return pieces[0] as string;
  return `${pieces[0]} and ${pieces[1]}`;
}

export function resolveModuleState(input: DashboardModuleStateInput): "loading" | "error" | "empty" | "content" {
  if (input.loading) return "loading";
  if (input.error) return "error";
  if (input.items === 0) return "empty";
  return "content";
}
