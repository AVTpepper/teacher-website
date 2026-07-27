import { adminDb } from "@/lib/server/firebaseAdmin";
import { makeSlug } from "@/lib/utils";

type PublicEducatorPreview = {
  uid: string;
  displayName: string;
  photoURL: string | null;
  gradeLevel: string;
  subjects: string[];
  professionalRole?: string;
  country?: string;
  bio?: string;
};

type PublicEvidenceKind = "discussion" | "inspiration";

type PublicEvidenceItem = {
  id: string;
  kind: PublicEvidenceKind;
  title: string;
  subtitle: string;
  href: string;
};

type PublicEvidenceStats = {
  educators: number;
  discussions: number;
  inspiration: number;
  liveExamples: number;
};

const EMPTY_STATS: PublicEvidenceStats = {
  educators: 0,
  discussions: 0,
  inspiration: 0,
  liveExamples: 0,
};

const EMPTY_RESPONSE = {
  educators: [] as PublicEducatorPreview[],
  evidence: {
    stats: EMPTY_STATS,
    items: [] as PublicEvidenceItem[],
  },
};

const FORUM_CATEGORY_IDS = [
  "classroom-management",
  "lesson-planning",
  "student-engagement",
  "technology-in-education",
  "teacher-support",
  "grade-level-discussions",
  "general-discussion",
  "questions-answers",
] as const;

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

function mapEducatorPreview(uid: string, value: unknown): PublicEducatorPreview | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const data = value as Record<string, unknown>;
  const displayName = typeof data.displayName === "string" ? data.displayName.trim() : "";
  if (!displayName) return null;

  return {
    uid,
    displayName,
    photoURL: typeof data.photoURL === "string" ? data.photoURL : null,
    gradeLevel: typeof data.gradeLevel === "string" ? data.gradeLevel : "",
    subjects: asStringArray(data.subjects),
    professionalRole: typeof data.professionalRole === "string" ? data.professionalRole : undefined,
    country: typeof data.country === "string" ? data.country : undefined,
    bio: typeof data.bio === "string" ? data.bio : undefined,
  };
}

function mapDiscussionEvidence(id: string, value: unknown): PublicEvidenceItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const title = typeof data.title === "string" ? data.title.trim() : "";
  if (!title) return null;

  const authorName = typeof data.authorName === "string" ? data.authorName.trim() : "";

  return {
    id,
    kind: "discussion",
    title,
    subtitle: authorName ? `Discussion · ${authorName}` : "Discussion",
    href: `/forums/${makeSlug(title, id)}`,
  };
}

function mapInspirationEvidence(id: string, value: unknown): PublicEvidenceItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const title = typeof data.title === "string" ? data.title.trim() : "";
  if (!title) return null;

  const creator = typeof data.creator === "string" ? data.creator.trim() : "";

  return {
    id,
    kind: "inspiration",
    title,
    subtitle: creator ? `Inspiration · ${creator}` : "Inspiration",
    href: `/inspiration/${id}`,
  };
}

async function findDiscussionDoc(threadId: string): Promise<Record<string, unknown> | null> {
  try {
    const byIdField = await adminDb.collectionGroup("threads").where("id", "==", threadId).limit(1).get();
    if (byIdField.docs[0]) {
      return byIdField.docs[0].data() as Record<string, unknown>;
    }
  } catch {
    // Fall back to deterministic category scans.
  }

  for (const categoryId of FORUM_CATEGORY_IDS) {
    try {
      const snap = await adminDb.collection("forums").doc(categoryId).collection("threads").doc(threadId).get();
      if (snap.exists) {
        return snap.data() as Record<string, unknown>;
      }
    } catch {
      // Continue trying other categories.
    }
  }

  return null;
}

export async function GET(): Promise<Response> {
  try {
    const showcaseSnap = await adminDb.collection("siteConfig").doc("publicShowcase").get();
    if (!showcaseSnap.exists) {
      return Response.json(EMPTY_RESPONSE);
    }

    const showcase = showcaseSnap.data() as Record<string, unknown>;
    const educatorIds = asStringArray(showcase.educatorProfileIds).slice(0, 6);
    const discussionIds = asStringArray(showcase.discussionIds).slice(0, 4);
    const inspirationIds = asStringArray(showcase.inspirationIds).slice(0, 4);

    const educatorDocs = await Promise.all(
      educatorIds.map(async (uid) => {
        try {
          return await adminDb.collection("users").doc(uid).get();
        } catch {
          return null;
        }
      })
    );

    const discussionDocs = await Promise.all(
      discussionIds.map(async (id) => {
        try {
          return await findDiscussionDoc(id);
        } catch {
          return null;
        }
      })
    );

    const inspirationDocs = await Promise.all(
      inspirationIds.map(async (id) => {
        try {
          return await adminDb.collection("inspiration").doc(id).get();
        } catch {
          return null;
        }
      })
    );

    const educators = educatorDocs
      .map((snap, index) => {
        if (!snap || !snap.exists) return null;
        return mapEducatorPreview(educatorIds[index]!, snap.data());
      })
      .filter((item): item is PublicEducatorPreview => item !== null);

    const discussions = discussionDocs
      .map((data, index) => {
        if (!data) return null;
        return mapDiscussionEvidence(discussionIds[index]!, data);
      })
      .filter((item): item is PublicEvidenceItem => item !== null);

    const inspiration = inspirationDocs
      .map((snap, index) => {
        if (!snap || !snap.exists) return null;
        return mapInspirationEvidence(inspirationIds[index]!, snap.data());
      })
      .filter((item): item is PublicEvidenceItem => item !== null);

    const evidenceItems = [...discussions, ...inspiration].slice(0, 8);
    const stats: PublicEvidenceStats = {
      educators: educators.length,
      discussions: discussions.length,
      inspiration: inspiration.length,
      liveExamples: educators.length + discussions.length + inspiration.length,
    };

    return Response.json({
      educators,
      evidence: {
        stats,
        items: evidenceItems,
      },
    });
  } catch {
    return Response.json(EMPTY_RESPONSE, { status: 200 });
  }
}