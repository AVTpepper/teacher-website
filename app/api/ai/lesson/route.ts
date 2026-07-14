import type { NextRequest } from "next/server";
import OpenAI from "openai";
import { createPublicKey, createVerify } from "crypto";

// ─── Firebase ID Token Verification ──────────────────────────────────────────
// Tokens are RS256 JWTs; we verify against Google's published X.509 certs.
const FIREBASE_CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

async function verifyFirebaseToken(token: string): Promise<string | null> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const header = JSON.parse(
      Buffer.from(parts[0], "base64url").toString("utf8"),
    ) as Record<string, unknown>;

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    ) as Record<string, unknown>;

    // Validate standard JWT claims required by Firebase Auth
    const now = Math.floor(Date.now() / 1000);
    if (
      typeof payload.exp !== "number" ||
      typeof payload.iat !== "number" ||
      typeof payload.sub !== "string" ||
      !payload.sub ||
      payload.exp < now ||
      payload.iat > now + 300 || // 5-min clock-skew tolerance
      payload.aud !== projectId ||
      payload.iss !== `https://securetoken.google.com/${projectId}`
    ) {
      return null;
    }

    // Fetch Google's signing certificates (cached for 1 hour)
    const resp = await fetch(FIREBASE_CERTS_URL, {
      next: { revalidate: 3600 },
    });
    if (!resp.ok) return null;

    const certs = (await resp.json()) as Record<string, string>;
    const cert = certs[header.kid as string];
    if (!cert) return null;

    // Verify RS256 signature
    const publicKey = createPublicKey(cert);
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${parts[0]}.${parts[1]}`);
    const signature = Buffer.from(parts[2], "base64url");
    if (!verifier.verify(publicKey, signature)) return null;

    return payload.sub;
  } catch {
    return null;
  }
}

// ─── Firestore REST helpers ───────────────────────────────────────────────────
// We use the Firestore REST API with the user's own ID token so we never need
// firebase-admin. The token was already verified above, so Firestore rules that
// check `request.auth.uid` will accept these calls.

const FREE_DAILY_LIMIT = 10;
const FREE_MONTHLY_REFINE_LIMIT = 20;
const FREE_GENERATED_ASSET_LIMIT = 2;
const PLUS_GENERATED_ASSET_LIMIT = 2;

const VALID_ACTIVITY_STYLES = [
  "Hands-on exploration",
  "Discussion-based learning",
  "Direct instruction with practice",
  "Collaborative group work",
  "Inquiry-based learning",
  "Project-based learning",
] as const;

const LESSON_FLOW_OPTIONS = [
  "Mini-lesson",
  "Workshop",
  "Station rotation",
  "Direct instruction",
  "Lab",
] as const;

const ASSESSMENT_INTENT_OPTIONS = ["Formative only", "Summative only", "Mixed"] as const;
const TIME_PER_CLASS_OPTIONS = ["30 min", "45 min", "60 min", "75+ min"] as const;
const CLASS_SIZE_OPTIONS = ["1-15", "16-25", "26-35", "36+"] as const;
const ELL_OPTIONS = ["0-10%", "11-25%", "26-50%", "50%+"] as const;
const IEP_504_OPTIONS = ["yes", "no"] as const;
const TECH_AVAILABLE_OPTIONS = ["yes", "no", "limited"] as const;

function getUtcDateKey(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getUtcMonthKey(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

async function fsGet(
  path: string,
  idToken: string,
): Promise<Record<string, unknown> | null> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return null;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`;
  try {
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${idToken}` },
      cache: "no-store",
    });
    if (resp.status === 404) return null;
    if (!resp.ok) return null;
    return (await resp.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function fsIncrementCount(
  path: string,
  idToken: string,
): Promise<void> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`;
  const docPath = `projects/${projectId}/databases/(default)/documents/${path}`;
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        writes: [{
          transform: {
            document: docPath,
            fieldTransforms: [{ fieldPath: "count", increment: { integerValue: "1" } }],
          },
        }],
      }),
      cache: "no-store",
    });
  } catch {
    // Non-critical - best-effort write
  }
}

function fsStringField(
  doc: Record<string, unknown> | null,
  field: string,
): string | null {
  if (!doc) return null;
  const fields = (doc.fields ?? {}) as Record<string, Record<string, string>>;
  return fields[field]?.stringValue ?? null;
}

function fsIntField(
  doc: Record<string, unknown> | null,
  field: string,
): number {
  if (!doc) return 0;
  const fields = (doc.fields ?? {}) as Record<string, Record<string, string>>;
  const f = fields[field];
  if (!f) return 0;
  return parseInt(f.integerValue ?? f.doubleValue ?? "0", 10) || 0;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ValidSection = "objectives" | "materials" | "steps" | "checkForUnderstanding" | "assessments";
type GeneratedAssetType = "worksheet" | "rubric";

interface AssetRequest {
  type: GeneratedAssetType;
  example?: string;
}

interface GeneratedAsset {
  type: GeneratedAssetType;
  title: string;
  description: string;
  sections: Array<{ heading: string; body: string }>;
}

import { GRADE_LEVELS as VALID_GRADE_LEVELS, SPECIFIC_GRADE_LEVELS } from "@/lib/constants";

const ALL_VALID_GRADE_LEVELS = [...VALID_GRADE_LEVELS, ...SPECIFIC_GRADE_LEVELS] as readonly string[];

interface GenerateBody {
  mode: "generate";
  topic: string;
  gradeLevel: string;
  subject: string;
  learningGoal?: string;
  studentSupports?: string;
  activityStyle?: string;
  activityStyles?: string[];
  stylePriority?: {
    primary?: string;
    secondary?: string;
  };
  estimatedLessonFlow?: string;
  assessmentIntent?: string;
  classConstraints?: {
    timePerClass?: string;
    classSize?: string;
    ellPercent?: string;
    iep504Supports?: string;
    techAvailable?: string;
  };
  assetRequests?: AssetRequest[];
  gradeLevelOverride?: string;
  description?: string;
}

interface SuggestBody {
  mode: "suggest";
  gradeLevel: string;
  subject: string;
  section: ValidSection;
  existingContent?: string[];
  lessonContext?: {
    title?: string;
    duration?: string;
    objectives?: string[];
    materials?: string[];
    steps?: Array<{ title: string; description: string }>;
    checkForUnderstanding?: string[];
    assessments?: string[];
  };
}

interface RefineBody {
  mode: "refine";
  field: string;
  content: string | string[] | Array<{ title: string; description: string; duration?: string }>;
  instruction: string;
  gradeLevel: string;
  subject: string;
  lessonContext?: {
    title?: string;
    duration?: string;
    objectives?: string[];
    materials?: string[];
    steps?: Array<{ title: string; description: string; duration?: string }>;
    checkForUnderstanding?: string[];
    assessments?: string[];
  };
}

type RequestBody = GenerateBody | SuggestBody | RefineBody;

// ─── OpenAI client (module-level lazy singleton) ──────────────────────────────
// OPENAI_API_KEY is read exclusively from process.env - never exported to the client.

let _openai: OpenAI | null | undefined; // undefined = not yet initialised

function getOpenAIClient(): OpenAI | null {
  if (_openai !== undefined) return _openai;
  const apiKey = process.env.OPENAI_API_KEY;
  _openai = apiKey ? new OpenAI({ apiKey }) : null;
  return _openai;
}

function logGenerateMetrics(
  event: string,
  data: Record<string, unknown>,
): void {
  console.info(
    "[ai-generate-metrics]",
    JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      ...data,
    }),
  );
}

function isActivityStyle(value: string): boolean {
  return VALID_ACTIVITY_STYLES.includes(value as (typeof VALID_ACTIVITY_STYLES)[number]);
}

function normalizeGenerateStyles(body: GenerateBody): {
  styles: string[];
  stylePriority: { primary?: string; secondary?: string };
} {
  const styleSet = new Set<string>();

  if (Array.isArray(body.activityStyles)) {
    for (const style of body.activityStyles) {
      if (typeof style === "string" && isActivityStyle(style)) styleSet.add(style);
    }
  }
  if (typeof body.activityStyle === "string" && isActivityStyle(body.activityStyle.trim())) {
    styleSet.add(body.activityStyle.trim());
  }

  let primary = body.stylePriority?.primary?.trim();
  let secondary = body.stylePriority?.secondary?.trim();

  if (!primary || !isActivityStyle(primary)) primary = undefined;
  if (!secondary || !isActivityStyle(secondary) || secondary === primary) secondary = undefined;

  if (primary) styleSet.add(primary);
  if (secondary) styleSet.add(secondary);

  return {
    styles: Array.from(styleSet),
    stylePriority: {
      ...(primary ? { primary } : {}),
      ...(secondary ? { secondary } : {}),
    },
  };
}

function buildAssetsSchema(requestedAssetsCount: number): string {
  return requestedAssetsCount > 0
    ? `,
  "assets": [{"type": "worksheet" | "rubric", "title": "<string>", "description": "<what this asset is for>", "sections": [{"heading": "<section heading>", "body": "<plain text content for that section>"}]}]`
    : "";
}

type ParsedGenerateLesson = {
  title: string;
  duration?: string;
  objectives: string[];
  materials: string[];
  steps: Array<{ title: string; description: string; duration?: string }>;
  checkForUnderstanding: string[];
  assessments: string[];
  assets?: GeneratedAsset[];
};

function isValidGenerateLesson(value: unknown): value is ParsedGenerateLesson {
  if (!value || typeof value !== "object") return false;
  const lesson = value as Record<string, unknown>;
  return (
    typeof lesson.title === "string" &&
    Array.isArray(lesson.objectives) &&
    Array.isArray(lesson.materials) &&
    Array.isArray(lesson.steps) &&
    lesson.steps.every(
      (s) =>
        s !== null &&
        typeof s === "object" &&
        typeof (s as Record<string, unknown>).title === "string" &&
        typeof (s as Record<string, unknown>).description === "string",
    ) &&
    Array.isArray(lesson.checkForUnderstanding) &&
    Array.isArray(lesson.assessments)
  );
}

function extractRequestedAssets(
  lesson: ParsedGenerateLesson,
  requestedAssetTypes: Set<GeneratedAssetType>,
): GeneratedAsset[] {
  return Array.isArray(lesson.assets)
    ? (lesson.assets as unknown[])
        .filter(
          (asset): asset is GeneratedAsset =>
            asset !== null &&
            typeof asset === "object" &&
            (asset as Record<string, unknown>).type !== undefined &&
            requestedAssetTypes.has((asset as Record<string, unknown>).type as GeneratedAssetType) &&
            typeof (asset as Record<string, unknown>).title === "string" &&
            typeof (asset as Record<string, unknown>).description === "string" &&
            Array.isArray((asset as Record<string, unknown>).sections) &&
            ((asset as Record<string, unknown>).sections as unknown[]).every(
              (section) =>
                section !== null &&
                typeof section === "object" &&
                typeof (section as Record<string, unknown>).heading === "string" &&
                typeof (section as Record<string, unknown>).body === "string",
            ),
        )
        .map((asset) => ({
          type: asset.type,
          title: asset.title,
          description: asset.description,
          sections: asset.sections,
        }))
    : [];
}

function getAlignmentIssues(
  lesson: ParsedGenerateLesson,
  assessmentIntent?: string,
): string[] {
  const issues: string[] = [];
  if (lesson.objectives.filter((o) => o.trim() !== "").length < 2) {
    issues.push("Add at least 2 clear and measurable learning objectives.");
  }
  if (lesson.steps.filter((s) => s.title.trim() !== "").length < 3) {
    issues.push("Provide at least 3 concrete lesson steps with classroom-ready detail.");
  }

  const cfuCount = lesson.checkForUnderstanding.filter((item) => item.trim() !== "").length;
  const assessmentCount = lesson.assessments.filter((item) => item.trim() !== "").length;
  if (assessmentIntent === "Formative only" && cfuCount < 2) {
    issues.push("Include at least 2 formative checks for understanding.");
  }
  if (assessmentIntent === "Summative only" && assessmentCount < 2) {
    issues.push("Include at least 2 summative assessment tasks.");
  }
  if ((!assessmentIntent || assessmentIntent === "Mixed") && (cfuCount < 1 || assessmentCount < 1)) {
    issues.push("Include at least 1 check for understanding and 1 assessment for mixed intent.");
  }

  return issues;
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<Response> {
  // 1. Auth guard - require a valid Firebase ID token in the Authorization header
  const authHeader = request.headers.get("authorization");
  const token =
    authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (!token) {
    return Response.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const uid = await verifyFirebaseToken(token);
  if (!uid) {
    return Response.json(
      { error: "Invalid or expired session. Please sign in again." },
      { status: 401 },
    );
  }

  // 1a. Read user tier from Firestore (best-effort; default 'free' if unavailable)
  const userDoc = await fsGet(`users/${uid}`, token);
  const userTier: "free" | "plus" =
    fsStringField(userDoc, "tier") === "plus" ? "plus" : "free";

  // 2. OpenAI availability check - return 503, never crash
  const openai = getOpenAIClient();
  if (!openai) {
    return Response.json(
      { error: "AI features are not configured." },
      { status: 503 },
    );
  }

  // 3. Parse request body
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
    return Response.json(
      { error: "Request body must be a JSON object." },
      { status: 400 },
    );
  }

  const raw = rawBody as Record<string, unknown>;

  // 4. Validate common required fields
  if (raw.mode !== "generate" && raw.mode !== "suggest" && raw.mode !== "refine") {
    return Response.json(
      {
        error:
          'Field "mode" is required and must be "generate", "suggest", or "refine".',
      },
      { status: 400 },
    );
  }

  // ── Refine mode (fast path - separate limit, early return) ────────────────
  if (raw.mode === "refine") {
    // Validate instruction
    if (
      !raw.instruction ||
      typeof raw.instruction !== "string" ||
      !raw.instruction.trim()
    ) {
      return Response.json(
        { error: 'Field "instruction" is required and must be a non-empty string.' },
        { status: 400 },
      );
    }
    if ((raw.instruction as string).length > 300) {
      return Response.json(
        { error: 'Field "instruction" must be 300 characters or fewer.' },
        { status: 400 },
      );
    }
    if (!raw.field || typeof raw.field !== "string" || !raw.field.trim()) {
      return Response.json(
        { error: 'Field "field" is required and must be a non-empty string.' },
        { status: 400 },
      );
    }
    if (raw.content === undefined || raw.content === null) {
      return Response.json(
        { error: 'Field "content" is required.' },
        { status: 400 },
      );
    }
    if (!raw.gradeLevel || typeof raw.gradeLevel !== "string") {
      return Response.json(
        { error: 'Field "gradeLevel" is required.' },
        { status: 400 },
      );
    }
    if (!raw.subject || typeof raw.subject !== "string") {
      return Response.json(
        { error: 'Field "subject" is required.' },
        { status: 400 },
      );
    }

    // Monthly refine limit (free tier only)
    const monthKey = getUtcMonthKey();
    let currentRefineCount = 0;
    if (userTier === "free") {
      const refineDoc = await fsGet(`users/${uid}/aiRefineUsage/${monthKey}`, token);
      currentRefineCount = fsIntField(refineDoc, "count");
      if (currentRefineCount >= FREE_MONTHLY_REFINE_LIMIT) {
        return Response.json(
          {
            error: "You've reached your monthly refine limit (20). Upgrade to Plus for unlimited refines.",
            remainingRefines: 0,
          },
          { status: 429 },
        );
      }
    }

    // Build refine prompt
    const instruction = (raw.instruction as string).trim();
    const field = raw.field as string;
    const contentJson = JSON.stringify(raw.content);
    const gradeLevel = raw.gradeLevel as string;
    const subject = raw.subject as string;
    const lessonContext =
      raw.lessonContext && typeof raw.lessonContext === "object"
        ? (raw.lessonContext as RefineBody["lessonContext"])
        : undefined;

    const isStepsField = field === "steps";
    const stepStructureHint = isStepsField
      ? ' Return a JSON array of objects with shape {"title":"...","description":"...","duration":"..."}. '
      : " Return a JSON array of strings. ";

    const refineSystemPrompt = `You are an expert educator. You will be given the current content of a lesson plan section, the surrounding lesson context, and an instruction describing how to change it. Apply the instruction while keeping the revised section aligned with the lesson's title, objectives, pacing, and assessment approach. Return only the revised content as a JSON object: {"refined": <array>}.${stepStructureHint}No markdown, no code fences, no explanation.`;
    const refineUserMessage = `Grade Level: ${gradeLevel}\nSubject: ${subject}\nSection: ${field}\nCurrent content: ${contentJson}\nInstruction: ${instruction}`;

    let contextualRefineMessage = refineUserMessage;
    if (lessonContext) {
      if (lessonContext.title?.trim()) {
        contextualRefineMessage += `\nLesson title: ${lessonContext.title.trim()}`;
      }
      if (lessonContext.duration?.trim()) {
        contextualRefineMessage += `\nLesson duration: ${lessonContext.duration.trim()}`;
      }
      if (lessonContext.objectives && lessonContext.objectives.length > 0) {
        contextualRefineMessage += `\nLearning objectives: ${lessonContext.objectives.join("; ")}`;
      }
      if (lessonContext.materials && lessonContext.materials.length > 0) {
        contextualRefineMessage += `\nMaterials: ${lessonContext.materials.join("; ")}`;
      }
      if (lessonContext.steps && lessonContext.steps.length > 0) {
        const stepList = lessonContext.steps
          .map((step, index) => {
            const duration = step.duration ? ` (${step.duration})` : "";
            const description = step.description ? ` — ${step.description}` : "";
            return `Step ${index + 1}: ${step.title}${duration}${description}`;
          })
          .join("; ");
        contextualRefineMessage += `\nLesson steps: ${stepList}`;
      }
      if (
        lessonContext.checkForUnderstanding &&
        lessonContext.checkForUnderstanding.length > 0
      ) {
        contextualRefineMessage += `\nChecks for understanding: ${lessonContext.checkForUnderstanding.join("; ")}`;
      }
      if (lessonContext.assessments && lessonContext.assessments.length > 0) {
        contextualRefineMessage += `\nAssessments: ${lessonContext.assessments.join("; ")}`;
      }
    }

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: refineSystemPrompt },
          { role: "user", content: contextualRefineMessage },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      });

      const rawContent = completion.choices[0]?.message?.content;
      if (!rawContent) {
        return Response.json(
          { error: "The AI returned an empty response. Please try again." },
          { status: 502 },
        );
      }

      let parsed: unknown;
      try { parsed = JSON.parse(rawContent); } catch {
        return Response.json(
          { error: "The AI returned an unreadable response. Please try again." },
          { status: 502 },
        );
      }

      const data = parsed as Record<string, unknown>;
      if (!Array.isArray(data.refined)) {
        return Response.json(
          { error: "The AI returned an unexpected format. Please try again." },
          { status: 502 },
        );
      }

      // Increment monthly refine counter (free tier, best-effort)
      if (userTier === "free") {
        fsIncrementCount(`users/${uid}/aiRefineUsage/${monthKey}`, token).catch(() => {});
      }

      const remainingRefines: number | null =
        userTier === "free"
          ? Math.max(0, FREE_MONTHLY_REFINE_LIMIT - (currentRefineCount + 1))
          : null;

      return Response.json({ refined: data.refined, remainingRefines });
    } catch (err: unknown) {
      if (err && typeof err === "object") {
        const status = "status" in err ? (err as { status: number }).status : undefined;
        if (status === 429) {
          return Response.json(
            { error: "AI service is currently busy. Please wait and try again." },
            { status: 429 },
          );
        }
      }
      return Response.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 },
      );
    }
  }

  if (
    !raw.gradeLevel ||
    typeof raw.gradeLevel !== "string" ||
    !raw.gradeLevel.trim()
  ) {
    return Response.json(
      {
        error:
          'Field "gradeLevel" is required and must be a non-empty string.',
      },
      { status: 400 },
    );
  }

  if (
    !raw.subject ||
    typeof raw.subject !== "string" ||
    !raw.subject.trim()
  ) {
    return Response.json(
      {
        error: 'Field "subject" is required and must be a non-empty string.',
      },
      { status: 400 },
    );
  }

  // 5. Mode-specific validation
  if (raw.mode === "generate") {
    if (!raw.topic || typeof raw.topic !== "string" || !raw.topic.trim()) {
      return Response.json(
        {
          error:
            'Field "topic" is required and must be a non-empty string for mode "generate".',
        },
        { status: 400 },
      );
    }
    if ((raw.topic as string).length > 300) {
      return Response.json(
        { error: 'Field "topic" must be 300 characters or fewer.' },
        { status: 400 },
      );
    }
    // Optional Plus-tier fields
    if (raw.gradeLevelOverride !== undefined) {
      if (
        typeof raw.gradeLevelOverride !== "string" ||
        !raw.gradeLevelOverride.trim()
      ) {
        return Response.json(
          { error: 'Field "gradeLevelOverride" must be a non-empty string when provided.' },
          { status: 400 },
        );
      }
      if (raw.gradeLevelOverride.length > 100) {
        return Response.json(
          { error: 'Field "gradeLevelOverride" must be 100 characters or fewer.' },
          { status: 400 },
        );
      }
      if (!ALL_VALID_GRADE_LEVELS.includes(raw.gradeLevelOverride)) {
        return Response.json(
          { error: `Field "gradeLevelOverride" must be a valid grade level.` },
          { status: 400 },
        );
      }
    }
    if (raw.description !== undefined) {
      if (typeof raw.description !== "string") {
        return Response.json(
          { error: 'Field "description" must be a string when provided.' },
          { status: 400 },
        );
      }
      if (raw.description.length > 500) {
        return Response.json(
          { error: 'Field "description" must be 500 characters or fewer.' },
          { status: 400 },
        );
      }
    }
    if (raw.learningGoal !== undefined) {
      if (typeof raw.learningGoal !== "string") {
        return Response.json(
          { error: 'Field "learningGoal" must be a string when provided.' },
          { status: 400 },
        );
      }
      if (raw.learningGoal.length > 200) {
        return Response.json(
          { error: 'Field "learningGoal" must be 200 characters or fewer.' },
          { status: 400 },
        );
      }
    }
    if (raw.studentSupports !== undefined) {
      if (typeof raw.studentSupports !== "string") {
        return Response.json(
          { error: 'Field "studentSupports" must be a string when provided.' },
          { status: 400 },
        );
      }
      if (raw.studentSupports.length > 300) {
        return Response.json(
          { error: 'Field "studentSupports" must be 300 characters or fewer.' },
          { status: 400 },
        );
      }
    }
    if (raw.activityStyle !== undefined) {
      if (typeof raw.activityStyle !== "string") {
        return Response.json(
          { error: 'Field "activityStyle" must be a string when provided.' },
          { status: 400 },
        );
      }
      if (raw.activityStyle.length > 100) {
        return Response.json(
          { error: 'Field "activityStyle" must be 100 characters or fewer.' },
          { status: 400 },
        );
      }
    }
    if (raw.activityStyles !== undefined) {
      if (!Array.isArray(raw.activityStyles)) {
        return Response.json(
          { error: 'Field "activityStyles" must be an array of strings when provided.' },
          { status: 400 },
        );
      }
      if ((raw.activityStyles as unknown[]).some((item) => typeof item !== "string")) {
        return Response.json(
          { error: 'Field "activityStyles" must be an array of strings when provided.' },
          { status: 400 },
        );
      }
      if ((raw.activityStyles as string[]).length > VALID_ACTIVITY_STYLES.length) {
        return Response.json(
          { error: `Field "activityStyles" can include at most ${VALID_ACTIVITY_STYLES.length} options.` },
          { status: 400 },
        );
      }
      for (const style of raw.activityStyles as string[]) {
        if (!VALID_ACTIVITY_STYLES.includes(style as (typeof VALID_ACTIVITY_STYLES)[number])) {
          return Response.json(
            { error: "Field \"activityStyles\" contains an invalid style option." },
            { status: 400 },
          );
        }
      }
    }
    if (raw.stylePriority !== undefined) {
      if (!raw.stylePriority || typeof raw.stylePriority !== "object" || Array.isArray(raw.stylePriority)) {
        return Response.json(
          { error: 'Field "stylePriority" must be an object when provided.' },
          { status: 400 },
        );
      }
      const stylePriority = raw.stylePriority as Record<string, unknown>;
      if (stylePriority.primary !== undefined && typeof stylePriority.primary !== "string") {
        return Response.json(
          { error: 'Field "stylePriority.primary" must be a string when provided.' },
          { status: 400 },
        );
      }
      if (stylePriority.secondary !== undefined && typeof stylePriority.secondary !== "string") {
        return Response.json(
          { error: 'Field "stylePriority.secondary" must be a string when provided.' },
          { status: 400 },
        );
      }
      if (typeof stylePriority.primary === "string" && !isActivityStyle(stylePriority.primary.trim())) {
        return Response.json(
          { error: 'Field "stylePriority.primary" must be a valid activity style.' },
          { status: 400 },
        );
      }
      if (typeof stylePriority.secondary === "string" && !isActivityStyle(stylePriority.secondary.trim())) {
        return Response.json(
          { error: 'Field "stylePriority.secondary" must be a valid activity style.' },
          { status: 400 },
        );
      }
      if (
        typeof stylePriority.primary === "string" &&
        typeof stylePriority.secondary === "string" &&
        stylePriority.primary.trim() === stylePriority.secondary.trim()
      ) {
        return Response.json(
          { error: 'Field "stylePriority" must use different primary and secondary values.' },
          { status: 400 },
        );
      }
    }
    if (raw.estimatedLessonFlow !== undefined) {
      if (typeof raw.estimatedLessonFlow !== "string") {
        return Response.json(
          { error: 'Field "estimatedLessonFlow" must be a string when provided.' },
          { status: 400 },
        );
      }
      if (!LESSON_FLOW_OPTIONS.includes(raw.estimatedLessonFlow as (typeof LESSON_FLOW_OPTIONS)[number])) {
        return Response.json(
          { error: 'Field "estimatedLessonFlow" has an invalid option.' },
          { status: 400 },
        );
      }
    }
    if (raw.assessmentIntent !== undefined) {
      if (typeof raw.assessmentIntent !== "string") {
        return Response.json(
          { error: 'Field "assessmentIntent" must be a string when provided.' },
          { status: 400 },
        );
      }
      if (!ASSESSMENT_INTENT_OPTIONS.includes(raw.assessmentIntent as (typeof ASSESSMENT_INTENT_OPTIONS)[number])) {
        return Response.json(
          { error: 'Field "assessmentIntent" has an invalid option.' },
          { status: 400 },
        );
      }
    }
    if (raw.classConstraints !== undefined) {
      if (!raw.classConstraints || typeof raw.classConstraints !== "object" || Array.isArray(raw.classConstraints)) {
        return Response.json(
          { error: 'Field "classConstraints" must be an object when provided.' },
          { status: 400 },
        );
      }
      const constraints = raw.classConstraints as Record<string, unknown>;
      if (
        constraints.timePerClass !== undefined &&
        (typeof constraints.timePerClass !== "string" || !TIME_PER_CLASS_OPTIONS.includes(constraints.timePerClass as (typeof TIME_PER_CLASS_OPTIONS)[number]))
      ) {
        return Response.json(
          { error: 'Field "classConstraints.timePerClass" has an invalid option.' },
          { status: 400 },
        );
      }
      if (
        constraints.classSize !== undefined &&
        (typeof constraints.classSize !== "string" || !CLASS_SIZE_OPTIONS.includes(constraints.classSize as (typeof CLASS_SIZE_OPTIONS)[number]))
      ) {
        return Response.json(
          { error: 'Field "classConstraints.classSize" has an invalid option.' },
          { status: 400 },
        );
      }
      if (
        constraints.ellPercent !== undefined &&
        (typeof constraints.ellPercent !== "string" || !ELL_OPTIONS.includes(constraints.ellPercent as (typeof ELL_OPTIONS)[number]))
      ) {
        return Response.json(
          { error: 'Field "classConstraints.ellPercent" has an invalid option.' },
          { status: 400 },
        );
      }
      if (
        constraints.iep504Supports !== undefined &&
        (typeof constraints.iep504Supports !== "string" || !IEP_504_OPTIONS.includes(constraints.iep504Supports as (typeof IEP_504_OPTIONS)[number]))
      ) {
        return Response.json(
          { error: 'Field "classConstraints.iep504Supports" has an invalid option.' },
          { status: 400 },
        );
      }
      if (
        constraints.techAvailable !== undefined &&
        (typeof constraints.techAvailable !== "string" || !TECH_AVAILABLE_OPTIONS.includes(constraints.techAvailable as (typeof TECH_AVAILABLE_OPTIONS)[number]))
      ) {
        return Response.json(
          { error: 'Field "classConstraints.techAvailable" has an invalid option.' },
          { status: 400 },
        );
      }
    }
    if (raw.assetRequests !== undefined) {
      if (!Array.isArray(raw.assetRequests)) {
        return Response.json(
          { error: 'Field "assetRequests" must be an array when provided.' },
          { status: 400 },
        );
      }
      const maxAssets =
        userTier === "plus"
          ? PLUS_GENERATED_ASSET_LIMIT
          : FREE_GENERATED_ASSET_LIMIT;
      if (raw.assetRequests.length > maxAssets) {
        return Response.json(
          {
            error:
              userTier === "plus"
                ? `Plus users can generate up to ${PLUS_GENERATED_ASSET_LIMIT} linked assets per lesson in this version.`
                : `Free users can generate up to ${FREE_GENERATED_ASSET_LIMIT} linked asset per lesson. Upgrade to Plus for more.`,
          },
          { status: 400 },
        );
      }
      for (const item of raw.assetRequests) {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return Response.json(
            { error: 'Each item in "assetRequests" must be an object.' },
            { status: 400 },
          );
        }

        const requestItem = item as Record<string, unknown>;
        if (
          requestItem.type !== "worksheet" &&
          requestItem.type !== "rubric"
        ) {
          return Response.json(
            { error: 'Each asset request type must be "worksheet" or "rubric".' },
            { status: 400 },
          );
        }
        if (
          requestItem.example !== undefined &&
          typeof requestItem.example !== "string"
        ) {
          return Response.json(
            { error: 'Each asset request example must be a string when provided.' },
            { status: 400 },
          );
        }
        if (
          typeof requestItem.example === "string" &&
          requestItem.example.length > 500
        ) {
          return Response.json(
            { error: 'Each asset request example must be 500 characters or fewer.' },
            { status: 400 },
          );
        }
      }
    }
  } else {
    const VALID_SECTIONS: ValidSection[] = [
      "objectives",
      "materials",
      "steps",
      "checkForUnderstanding",
      "assessments",
    ];
    if (
      !raw.section ||
      typeof raw.section !== "string" ||
      !VALID_SECTIONS.includes(raw.section as ValidSection)
    ) {
      return Response.json(
        {
          error:
            'Field "section" is required for mode "suggest" and must be "objectives", "materials", "steps", "checkForUnderstanding", or "assessments".',
        },
        { status: 400 },
      );
    }

    if (
      raw.existingContent !== undefined &&
      (!Array.isArray(raw.existingContent) ||
        (raw.existingContent as unknown[]).some(
          (item) => typeof item !== "string",
        ))
    ) {
      return Response.json(
        {
          error:
            'Field "existingContent" must be an array of strings when provided.',
        },
        { status: 400 },
      );
    }
    if (
      Array.isArray(raw.existingContent) &&
      (raw.existingContent as string[]).some((item) => item.length > 500)
    ) {
      return Response.json(
        { error: 'Each item in "existingContent" must be 500 characters or fewer.' },
        { status: 400 },
      );
    }
  }

  const body = raw as unknown as RequestBody;

  // 5a. Enforce free-tier daily limit (server-side - cannot be bypassed by the client)
  const dateKey = getUtcDateKey();
  let currentCount = 0;
  if (userTier === "free") {
    const usageDoc = await fsGet(`users/${uid}/aiUsage/${dateKey}`, token);
    currentCount = fsIntField(usageDoc, "count");
    if (currentCount >= FREE_DAILY_LIMIT) {
      return Response.json(
        {
          error:
            "You've reached your daily AI limit (10 requests). Upgrade to Plus for unlimited access.",
          remainingRequests: 0,
        },
        { status: 429 },
      );
    }
  }

  // 6. Build prompts and call OpenAI
  let systemPrompt: string;
  let userMessage: string;

  if (body.mode === "generate") {
    const requestedAssets = body.assetRequests ?? [];
    const assetsSchema = buildAssetsSchema(requestedAssets.length);
    const normalizedStyles = normalizeGenerateStyles(body);

    systemPrompt = `You are an expert educator. Given a topic, grade level, and subject, return a complete lesson plan as a single JSON object with exactly this structure:
{
  "title": "<string>",
  "duration": "<total duration — must equal the exact sum of all step durations, e.g. '45 minutes' or '90 minutes'>",
  "objectives": ["<string>"],
  "materials": ["<string>"],
  "steps": [{"title": "<step title>", "description": "<1-2 sentence description of what happens in this step>", "duration": "<e.g. 5 minutes>"}],
  "checkForUnderstanding": ["<question or activity to check student comprehension>"],
  "assessments": ["<assessment method or task>"]${assetsSchema}
}
IMPORTANT: The top-level "duration" field MUST equal the sum of all individual step duration values. If your steps total 45 minutes, "duration" must be "45 minutes". Do not invent a different number of class periods.
Write a classroom-ready plan with 3-5 concrete objectives, age-appropriate activities, realistic timing, and materials that clearly support the lesson steps.
When support needs or activity preferences are provided, incorporate them throughout the plan instead of mentioning them once.
If asset requests are included, create those assets so they clearly match the lesson objectives, sequence, and assessment expectations. Worksheet content should be student-facing. Rubrics should include clear criteria and concise performance descriptors.
Return only the raw JSON object - no markdown, no code fences, no explanation.`;

    // Use gradeLevelOverride (plus-tier only) if provided, otherwise fall back to gradeLevel
    const effectiveGradeLevel =
      userTier === "plus" && body.gradeLevelOverride?.trim()
        ? body.gradeLevelOverride.trim()
        : body.gradeLevel;

    const promptLines: string[] = [
      "Create a lesson plan for:",
      `Topic: ${body.topic}`,
      `Grade Level: ${effectiveGradeLevel}`,
      `Subject: ${body.subject}`,
    ];

    if (body.learningGoal?.trim()) promptLines.push(`Learning goal: ${body.learningGoal.trim()}`);
    if (body.studentSupports?.trim()) {
      promptLines.push(`Student support needs: ${body.studentSupports.trim()}`);
    }
    if (body.estimatedLessonFlow?.trim()) {
      promptLines.push(`Estimated lesson flow: ${body.estimatedLessonFlow.trim()}`);
    }
    if (body.assessmentIntent?.trim()) {
      promptLines.push(`Assessment intent: ${body.assessmentIntent.trim()}`);
    }
    if (body.classConstraints) {
      const constraints = body.classConstraints;
      const constraintLines: string[] = [];
      if (constraints.timePerClass) constraintLines.push(`time per class: ${constraints.timePerClass}`);
      if (constraints.classSize) constraintLines.push(`class size: ${constraints.classSize}`);
      if (constraints.ellPercent) constraintLines.push(`ELL %: ${constraints.ellPercent}`);
      if (constraints.iep504Supports) constraintLines.push(`IEP/504 supports: ${constraints.iep504Supports}`);
      if (constraints.techAvailable) constraintLines.push(`tech available: ${constraints.techAvailable}`);
      if (constraintLines.length > 0) {
        promptLines.push(`Class constraints: ${constraintLines.join(", ")}`);
      }
    }
    if (normalizedStyles.styles.length > 0) {
      promptLines.push(`Preferred activity styles: ${normalizedStyles.styles.join(", ")}`);
    }
    if (normalizedStyles.stylePriority.primary || normalizedStyles.stylePriority.secondary) {
      promptLines.push(
        `Style priority: primary=${normalizedStyles.stylePriority.primary ?? "none"}; secondary=${normalizedStyles.stylePriority.secondary ?? "none"}`,
      );
    }
    if (userTier === "plus" && body.description?.trim()) {
      promptLines.push(`Additional context: ${body.description.trim()}`);
    }

    userMessage = promptLines.join("\n");
    if (requestedAssets.length > 0) {
      const assetLines = requestedAssets.map((asset, index) => {
        const example = asset.example?.trim()
          ? ` Example or direction: ${asset.example.trim()}`
          : " Generate it fully from the lesson.";
        return `Asset ${index + 1}: ${asset.type}.${example}`;
      });
      userMessage += `\nCreate linked teaching assets:\n${assetLines.join("\n")}`;
    }

    logGenerateMetrics("generate_request", {
      userTier,
      uidTag: uid.slice(0, 8),
      styles: normalizedStyles.styles,
      stylePriority: normalizedStyles.stylePriority,
      requestedAssetTypes: requestedAssets.map((asset) => asset.type),
      estimatedLessonFlow: body.estimatedLessonFlow ?? null,
      assessmentIntent: body.assessmentIntent ?? null,
    });
  } else {
    const sb = body as SuggestBody;
    const existing =
      sb.existingContent && sb.existingContent.length > 0
        ? JSON.stringify(sb.existingContent)
        : "(none provided)";

    if (sb.section === "steps") {
      systemPrompt = `You are an expert educator. Given existing lesson steps, return improved or alternative steps as a JSON object with exactly this structure:
{
  "suggestions": [{"title": "<step title>", "description": "<1-2 sentence description of what happens in this step>", "duration": "<e.g. 5 minutes>"}]
}
Return only the raw JSON object - no markdown, no code fences, no explanation.`;
    } else if (sb.section === "checkForUnderstanding") {
      systemPrompt = `You are an expert educator. Return check-for-understanding questions or activities as a JSON object with exactly this structure:
{
  "suggestions": ["<question or activity>"]
}
Return only the raw JSON object - no markdown, no code fences, no explanation.`;
    } else if (sb.section === "assessments") {
      systemPrompt = `You are an expert educator. Return suggested assessment methods or tasks as a JSON object with exactly this structure:
{
  "suggestions": ["<assessment description>"]
}
Return only the raw JSON object - no markdown, no code fences, no explanation.`;
    } else {
      systemPrompt = `You are an expert educator. Given a lesson section name and its current content, return improved or alternative items for that section as a JSON object with exactly this structure:
{
  "suggestions": ["<string>", "<string>"]
}
Return only the raw JSON object - no markdown, no code fences, no explanation.`;
    }

    userMessage = `Improve the "${sb.section}" section for:
Grade Level: ${sb.gradeLevel}
Subject: ${sb.subject}
Current content: ${existing}`;

    // Append lesson context if provided so suggestions stay aligned with the full lesson.
    if (sb.lessonContext) {
      const ctx = sb.lessonContext;
      if (ctx.title) userMessage += `\nLesson title: ${ctx.title}`;
      if (ctx.duration) userMessage += `\nLesson duration: ${ctx.duration}`;
      if (ctx.objectives && ctx.objectives.length > 0) {
        userMessage += `\nLearning objectives: ${ctx.objectives.join("; ")}`;
      }
      if (ctx.materials && ctx.materials.length > 0) {
        userMessage += `\nMaterials: ${ctx.materials.join("; ")}`;
      }
      if (ctx.steps && ctx.steps.length > 0) {
        const stepList = ctx.steps.map((s, i) => `Step ${i + 1}: ${s.title}${s.description ? ` — ${s.description}` : ""}`).join("; ");
        userMessage += `\nLesson steps so far: ${stepList}`;
      }
      if (ctx.checkForUnderstanding && ctx.checkForUnderstanding.length > 0) {
        userMessage += `\nChecks for understanding: ${ctx.checkForUnderstanding.join("; ")}`;
      }
      if (ctx.assessments && ctx.assessments.length > 0) {
        userMessage += `\nAssessments: ${ctx.assessments.join("; ")}`;
      }
    }
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const rawContent = completion.choices[0]?.message?.content;
    if (!rawContent) {
      return Response.json(
        { error: "The AI returned an empty response. Please try again." },
        { status: 502 },
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      return Response.json(
        {
          error: "The AI returned an unreadable response. Please try again.",
        },
        { status: 502 },
      );
    }

    if (body.mode === "generate") {
      if (!isValidGenerateLesson(parsed)) {
        return Response.json(
          {
            error:
              "The AI returned an unexpected format. Please try again.",
          },
          { status: 502 },
        );
      }
      let lesson = parsed as ParsedGenerateLesson;
      const requestedAssetTypes = new Set((body.assetRequests ?? []).map((asset) => asset.type));
      let assets = extractRequestedAssets(lesson, requestedAssetTypes);

      const alignmentIssues = getAlignmentIssues(lesson, body.assessmentIntent);
      let repaired = false;
      if (alignmentIssues.length > 0) {
        try {
          const repairPrompt = `You are repairing a generated lesson plan for classroom quality and alignment.\nFix only what is needed to resolve the issues below while preserving the original topic and intent.\nReturn only valid JSON in this exact schema:${buildAssetsSchema((body.assetRequests ?? []).length).replace("\\n", " ")}\n\nIssues to fix:\n- ${alignmentIssues.join("\n- ")}`;
          const repairInput = {
            lesson: {
              title: lesson.title,
              duration: lesson.duration ?? "",
              objectives: lesson.objectives,
              materials: lesson.materials,
              steps: lesson.steps,
              checkForUnderstanding: lesson.checkForUnderstanding,
              assessments: lesson.assessments,
              ...(assets.length > 0 ? { assets } : {}),
            },
          };

          const repairCompletion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: repairPrompt },
              { role: "user", content: JSON.stringify(repairInput) },
            ],
            temperature: 0.2,
            response_format: { type: "json_object" },
          });

          const repairedContent = repairCompletion.choices[0]?.message?.content;
          if (repairedContent) {
            const repairedParsed = JSON.parse(repairedContent) as unknown;
            if (isValidGenerateLesson(repairedParsed)) {
              lesson = repairedParsed as ParsedGenerateLesson;
              assets = extractRequestedAssets(lesson, requestedAssetTypes);
              repaired = true;
            }
          }
        } catch {
          // If repair fails, return the original validated lesson.
        }
      }

      logGenerateMetrics("generate_success", {
        userTier,
        uidTag: uid.slice(0, 8),
        requestedAssetCount: (body.assetRequests ?? []).length,
        returnedAssetCount: assets.length,
        alignmentIssueCount: alignmentIssues.length,
        repaired,
      });
      // Increment usage counter for free tier (best-effort; do not block the response)
      if (userTier === "free") {
        fsIncrementCount(`users/${uid}/aiUsage/${dateKey}`, token).catch(() => {});
      }
      return Response.json({
        lesson: {
          title: lesson.title,
          duration: typeof lesson.duration === "string" ? lesson.duration : "",
          objectives: lesson.objectives,
          materials: lesson.materials,
          steps: lesson.steps,
          checkForUnderstanding: lesson.checkForUnderstanding,
          assessments: lesson.assessments,
        },
        assets,
        remainingRequests:
          userTier === "free"
            ? Math.max(0, FREE_DAILY_LIMIT - (currentCount + 1))
            : null,
      });
    } else {
      const data = parsed as Record<string, unknown>;
      if (!Array.isArray(data.suggestions)) {
        return Response.json(
          {
            error:
              "The AI returned an unexpected format. Please try again.",
          },
          { status: 502 },
        );
      }
      // Increment usage counter for free tier (best-effort; do not block the response)
      if (userTier === "free") {
        fsIncrementCount(`users/${uid}/aiUsage/${dateKey}`, token).catch(() => {});
      }
      return Response.json({
        suggestions: data.suggestions as string[],
        remainingRequests:
          userTier === "free"
            ? Math.max(0, FREE_DAILY_LIMIT - (currentCount + 1))
            : null,
      });
    }
  } catch (err: unknown) {
    if (body.mode === "generate") {
      const status =
        err && typeof err === "object" && "status" in err
          ? (err as { status: number }).status
          : undefined;
      logGenerateMetrics("generate_failure", {
        userTier,
        uidTag: uid.slice(0, 8),
        status: status ?? null,
        message:
          err instanceof Error ? err.message.slice(0, 200) : "unknown_error",
      });
    }
    // Map all OpenAI SDK errors to safe, human-readable messages - no raw objects in responses
    if (err && typeof err === "object") {
      const status =
        "status" in err ? (err as { status: number }).status : undefined;
      if (status === 401) {
        return Response.json(
          {
            error:
              "AI service authentication failed. Please contact support.",
          },
          { status: 502 },
        );
      }
      if (status === 429) {
        return Response.json(
          {
            error:
              "AI service is currently busy. Please try again in a moment.",
          },
          { status: 429 },
        );
      }
      if (status === 500 || status === 503) {
        return Response.json(
          {
            error:
              "AI service is temporarily unavailable. Please try again later.",
          },
          { status: 502 },
        );
      }
    }
    return Response.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 },
    );
  }
}

// ─── GET /api/ai/lesson - usage check ────────────────────────────────────────
// Returns today's usage for the authenticated user: { tier, used, limit, remainingRequests }

export async function GET(request: NextRequest): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  const token =
    authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (!token) {
    return Response.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const uid = await verifyFirebaseToken(token);
  if (!uid) {
    return Response.json(
      { error: "Invalid or expired session. Please sign in again." },
      { status: 401 },
    );
  }

  const monthKey = getUtcMonthKey();
  const dateKey = getUtcDateKey();
  const [userDoc, usageDoc, refineDoc] = await Promise.all([
    fsGet(`users/${uid}`, token),
    fsGet(`users/${uid}/aiUsage/${dateKey}`, token),
    fsGet(`users/${uid}/aiRefineUsage/${monthKey}`, token),
  ]);

  const tier: "free" | "plus" =
    fsStringField(userDoc, "tier") === "plus" ? "plus" : "free";
  const used = fsIntField(usageDoc, "count");
  const usedRefines = fsIntField(refineDoc, "count");
  const limit: number | null = tier === "plus" ? null : FREE_DAILY_LIMIT;
  const remainingRequests: number | null =
    tier === "plus" ? null : Math.max(0, FREE_DAILY_LIMIT - used);
  const remainingRefines: number | null =
    tier === "plus" ? null : Math.max(0, FREE_MONTHLY_REFINE_LIMIT - usedRefines);

  return Response.json({ tier, used, limit, remainingRequests, remainingRefines });
}
