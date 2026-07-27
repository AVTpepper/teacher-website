import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { parseSlug } from "@/lib/utils";

export interface PublicShowcaseConfig {
  educatorProfileIds: string[];
  lessonPlanIds: string[];
  resourceIds: string[];
  discussionIds: string[];
  inspirationIds: string[];
  feedPostIds: string[];
}

export type ShowcaseKind = "educator" | "discussion" | "inspiration";

export interface ShowcaseTarget {
  kind: ShowcaseKind;
  id: string;
}

const DEFAULT_CONFIG: PublicShowcaseConfig = {
  educatorProfileIds: [],
  lessonPlanIds: [],
  resourceIds: [],
  discussionIds: [],
  inspirationIds: [],
  feedPostIds: [],
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item) => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

export async function getPublicShowcaseConfig(): Promise<PublicShowcaseConfig> {
  if (!db) {
    try {
      const response = await fetch("/api/public/showcase-config", { cache: "no-store" });
      if (!response.ok) return DEFAULT_CONFIG;
      const payload = (await response.json()) as Record<string, unknown>;
      return {
        educatorProfileIds: asStringArray(payload.educatorProfileIds),
        lessonPlanIds: asStringArray(payload.lessonPlanIds),
        resourceIds: asStringArray(payload.resourceIds),
        discussionIds: asStringArray(payload.discussionIds),
        inspirationIds: asStringArray(payload.inspirationIds),
        feedPostIds: asStringArray(payload.feedPostIds),
      };
    } catch {
      return DEFAULT_CONFIG;
    }
  }

  try {
    const snap = await getDoc(doc(db, "siteConfig", "publicShowcase"));
    if (!snap.exists()) return DEFAULT_CONFIG;

    const data = snap.data() as Record<string, unknown>;

    return {
      educatorProfileIds: asStringArray(data.educatorProfileIds),
      lessonPlanIds: asStringArray(data.lessonPlanIds),
      resourceIds: asStringArray(data.resourceIds),
      discussionIds: asStringArray(data.discussionIds),
      inspirationIds: asStringArray(data.inspirationIds),
      feedPostIds: asStringArray(data.feedPostIds),
    };
  } catch {
    try {
      const response = await fetch("/api/public/showcase-config", { cache: "no-store" });
      if (!response.ok) return DEFAULT_CONFIG;
      const payload = (await response.json()) as Record<string, unknown>;
      return {
        educatorProfileIds: asStringArray(payload.educatorProfileIds),
        lessonPlanIds: asStringArray(payload.lessonPlanIds),
        resourceIds: asStringArray(payload.resourceIds),
        discussionIds: asStringArray(payload.discussionIds),
        inspirationIds: asStringArray(payload.inspirationIds),
        feedPostIds: asStringArray(payload.feedPostIds),
      };
    } catch {
      return DEFAULT_CONFIG;
    }
  }
}

export function getShowcaseTarget(pathname: string | null): ShowcaseTarget | null {
  if (!pathname) return null;

  const normalized = pathname.replace(/\/+$/, "") || "/";

  const educatorMatch = normalized.match(/^\/educators\/([^/]+)$/);
  if (educatorMatch?.[1]) {
    return { kind: "educator", id: decodeURIComponent(educatorMatch[1]) };
  }

  const forumMatch = normalized.match(/^\/forums\/([^/]+)$/);
  if (forumMatch?.[1]) {
    const slugOrId = decodeURIComponent(forumMatch[1]);
    return { kind: "discussion", id: parseSlug(slugOrId) };
  }

  const inspirationMatch = normalized.match(/^\/inspiration\/([^/]+)$/);
  if (inspirationMatch?.[1]) {
    return { kind: "inspiration", id: decodeURIComponent(inspirationMatch[1]) };
  }

  return null;
}

export function isShowcaseTargetAllowed(
  target: ShowcaseTarget | null,
  config: PublicShowcaseConfig
): boolean {
  if (!target) return false;

  if (target.kind === "educator") {
    return config.educatorProfileIds.includes(target.id);
  }

  if (target.kind === "discussion") {
    return config.discussionIds.includes(target.id);
  }

  return config.inspirationIds.includes(target.id);
}
