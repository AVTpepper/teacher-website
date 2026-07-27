import { adminDb } from "@/lib/server/firebaseAdmin";

type PublicShowcaseConfig = {
  educatorProfileIds: string[];
  lessonPlanIds: string[];
  resourceIds: string[];
  discussionIds: string[];
  inspirationIds: string[];
  feedPostIds: string[];
};

const EMPTY_CONFIG: PublicShowcaseConfig = {
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
        .filter(Boolean),
    ),
  );
}

export async function GET(): Promise<Response> {
  try {
    const snap = await adminDb.collection("siteConfig").doc("publicShowcase").get();
    if (!snap.exists) {
      return Response.json(EMPTY_CONFIG);
    }

    const data = snap.data() as Record<string, unknown>;
    return Response.json({
      educatorProfileIds: asStringArray(data.educatorProfileIds),
      lessonPlanIds: asStringArray(data.lessonPlanIds),
      resourceIds: asStringArray(data.resourceIds),
      discussionIds: asStringArray(data.discussionIds),
      inspirationIds: asStringArray(data.inspirationIds),
      feedPostIds: asStringArray(data.feedPostIds),
    });
  } catch {
    return Response.json(EMPTY_CONFIG, { status: 200 });
  }
}
