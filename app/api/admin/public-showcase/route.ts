import type { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/server/apiAuth";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { makeSlug } from "@/lib/utils";
import type { PublicShowcaseConfig } from "@/lib/firestore/publicShowcase";

type ShowcaseKey = keyof PublicShowcaseConfig;

type ShowcaseItem = {
  id: string;
  label: string;
  subtitle: string;
  href: string | null;
  status: "found" | "missing";
};

type ShowcaseResponse = {
  config: PublicShowcaseConfig;
  items: Record<ShowcaseKey, ShowcaseItem[]>;
};

const EMPTY_CONFIG: PublicShowcaseConfig = {
  educatorProfileIds: [],
  lessonPlanIds: [],
  resourceIds: [],
  discussionIds: [],
  inspirationIds: [],
  feedPostIds: [],
};

function createMissingItem(id: string, label: string, subtitle: string): ShowcaseItem {
  return {
    id,
    label,
    subtitle,
    href: null,
    status: "missing",
  };
}

function createEmptyItems(): Record<ShowcaseKey, ShowcaseItem[]> {
  return {
    educatorProfileIds: [],
    lessonPlanIds: [],
    resourceIds: [],
    discussionIds: [],
    inspirationIds: [],
    feedPostIds: [],
  };
}

function asIdArray(value: unknown): string[] {
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

function normalizeConfig(value: unknown): PublicShowcaseConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return EMPTY_CONFIG;
  }

  const data = value as Record<string, unknown>;
  return {
    educatorProfileIds: asIdArray(data.educatorProfileIds),
    lessonPlanIds: asIdArray(data.lessonPlanIds),
    resourceIds: asIdArray(data.resourceIds),
    discussionIds: asIdArray(data.discussionIds),
    inspirationIds: asIdArray(data.inspirationIds),
    feedPostIds: asIdArray(data.feedPostIds),
  };
}

async function resolveEducators(ids: string[]): Promise<ShowcaseItem[]> {
  return Promise.all(
    ids.map(async (id) => {
      try {
        const docSnap = await adminDb.collection("users").doc(id).get();
        if (!docSnap.exists) {
          return createMissingItem(id, "Missing educator", "No matching user profile document.");
        }

        const data = docSnap.data() as Record<string, unknown>;
        const displayName = typeof data.displayName === "string" && data.displayName.trim() ? data.displayName.trim() : "Unnamed educator";
        const role = typeof data.professionalRole === "string" && data.professionalRole.trim() ? data.professionalRole.trim() : typeof data.gradeLevel === "string" ? data.gradeLevel : "Educator";
        const country = typeof data.country === "string" && data.country.trim() ? data.country.trim() : "";

        return {
          id,
          label: displayName,
          subtitle: country ? `${role} · ${country}` : role,
          href: `/educators/${id}`,
          status: "found",
        };
      } catch {
        return createMissingItem(id, "Missing educator", "Unable to resolve this educator right now.");
      }
    }),
  );
}

async function resolveLessons(ids: string[]): Promise<ShowcaseItem[]> {
  return Promise.all(
    ids.map(async (id) => {
      try {
        const docSnap = await adminDb.collection("lessons").doc(id).get();
        if (!docSnap.exists) {
          return createMissingItem(id, "Missing lesson", "No matching lesson document.");
        }

        const data = docSnap.data() as Record<string, unknown>;
        const title = typeof data.title === "string" && data.title.trim() ? data.title.trim() : "Untitled lesson";
        const gradeLevel = typeof data.gradeLevel === "string" ? data.gradeLevel : "";
        const subject = typeof data.subject === "string" ? data.subject : "";

        return {
          id,
          label: title,
          subtitle: [gradeLevel, subject].filter(Boolean).join(" · ") || "Lesson plan",
          href: `/lesson-builder/${id}`,
          status: "found",
        };
      } catch {
        return createMissingItem(id, "Missing lesson", "Unable to resolve this lesson right now.");
      }
    }),
  );
}

async function resolveResources(ids: string[]): Promise<ShowcaseItem[]> {
  return Promise.all(
    ids.map(async (id) => {
      try {
        const docSnap = await adminDb.collection("resources").doc(id).get();
        if (!docSnap.exists) {
          return createMissingItem(id, "Missing resource", "No matching resource document.");
        }

        const data = docSnap.data() as Record<string, unknown>;
        const title = typeof data.title === "string" && data.title.trim() ? data.title.trim() : "Untitled resource";
        const subject = typeof data.subject === "string" ? data.subject : "";
        const type = typeof data.type === "string" ? data.type : "Resource";

        return {
          id,
          label: title,
          subtitle: [type, subject].filter(Boolean).join(" · "),
          href: `/resources/${makeSlug(title, id)}`,
          status: "found",
        };
      } catch {
        return createMissingItem(id, "Missing resource", "Unable to resolve this resource right now.");
      }
    }),
  );
}

async function resolveDiscussions(ids: string[]): Promise<ShowcaseItem[]> {
  return Promise.all(
    ids.map(async (id) => {
      try {
        const querySnap = await adminDb.collectionGroup("threads").where("id", "==", id).limit(1).get();
        const docSnap = querySnap.docs[0];
        if (!docSnap) {
          return createMissingItem(id, "Missing discussion", "No matching forum thread document.");
        }

        const data = docSnap.data() as Record<string, unknown>;
        const title = typeof data.title === "string" && data.title.trim() ? data.title.trim() : "Untitled discussion";
        const authorName = typeof data.authorName === "string" ? data.authorName : "Unknown author";

        return {
          id,
          label: title,
          subtitle: `Discussion · ${authorName}`,
          href: `/forums/${makeSlug(title, id)}`,
          status: "found",
        };
      } catch {
        return createMissingItem(id, "Missing discussion", "Unable to resolve this discussion right now.");
      }
    }),
  );
}

async function resolveInspiration(ids: string[]): Promise<ShowcaseItem[]> {
  return Promise.all(
    ids.map(async (id) => {
      try {
        const docSnap = await adminDb.collection("inspiration").doc(id).get();
        if (!docSnap.exists) {
          return createMissingItem(id, "Missing inspiration post", "No matching inspiration document.");
        }

        const data = docSnap.data() as Record<string, unknown>;
        const title = typeof data.title === "string" && data.title.trim() ? data.title.trim() : "Untitled inspiration";
        const creator = typeof data.creator === "string" && data.creator.trim() ? data.creator.trim() : "Community";

        return {
          id,
          label: title,
          subtitle: `Inspiration · ${creator}`,
          href: `/inspiration/${id}`,
          status: "found",
        };
      } catch {
        return createMissingItem(id, "Missing inspiration post", "Unable to resolve this inspiration item right now.");
      }
    }),
  );
}

async function resolveFeedPosts(ids: string[]): Promise<ShowcaseItem[]> {
  return Promise.all(
    ids.map(async (id) => {
      try {
        const docSnap = await adminDb.collection("posts").doc(id).get();
        if (!docSnap.exists) {
          return createMissingItem(id, "Missing feed post", "No matching post document.");
        }

        const data = docSnap.data() as Record<string, unknown>;
        const content = typeof data.content === "string" ? data.content.trim() : "";
        const authorName = typeof data.authorName === "string" && data.authorName.trim() ? data.authorName.trim() : "Unknown author";
        const type = typeof data.type === "string" ? data.type : "Post";
        const label = content ? content.slice(0, 80) + (content.length > 80 ? "..." : "") : "Untitled post";

        return {
          id,
          label,
          subtitle: `${type} · ${authorName}`,
          href: `/home?post=${encodeURIComponent(id)}`,
          status: "found",
        };
      } catch {
        return createMissingItem(id, "Missing feed post", "Unable to resolve this post right now.");
      }
    }),
  );
}

async function buildResponse(config: PublicShowcaseConfig): Promise<ShowcaseResponse> {
  const [educators, lessons, resources, discussions, inspiration, feedPosts] = await Promise.all([
    resolveEducators(config.educatorProfileIds).catch(() => []),
    resolveLessons(config.lessonPlanIds).catch(() => []),
    resolveResources(config.resourceIds).catch(() => []),
    resolveDiscussions(config.discussionIds).catch(() => []),
    resolveInspiration(config.inspirationIds).catch(() => []),
    resolveFeedPosts(config.feedPostIds).catch(() => []),
  ]);

  return {
    config,
    items: {
      educatorProfileIds: educators,
      lessonPlanIds: lessons,
      resourceIds: resources,
      discussionIds: discussions,
      inspirationIds: inspiration,
      feedPostIds: feedPosts,
    },
  };
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    await requireAdmin(request);

    const snap = await adminDb.collection("siteConfig").doc("publicShowcase").get();
    const config = snap.exists ? normalizeConfig(snap.data()) : EMPTY_CONFIG;
    try {
      return Response.json(await buildResponse(config));
    } catch {
      return Response.json({ config, items: createEmptyItems() });
    }
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    if (err instanceof Error && err.message === "FORBIDDEN") {
      return Response.json({ error: "Admin access required." }, { status: 403 });
    }
    return Response.json({ error: "Failed to load public showcase config." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest): Promise<Response> {
  try {
    await requireAdmin(request);
    const body = normalizeConfig(await request.json().catch(() => ({})));

    await adminDb.collection("siteConfig").doc("publicShowcase").set(
      {
        ...body,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    try {
      return Response.json(await buildResponse(body));
    } catch {
      return Response.json({ config: body, items: createEmptyItems() });
    }
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    if (err instanceof Error && err.message === "FORBIDDEN") {
      return Response.json({ error: "Admin access required." }, { status: 403 });
    }
    return Response.json({ error: "Failed to update public showcase config." }, { status: 500 });
  }
}
