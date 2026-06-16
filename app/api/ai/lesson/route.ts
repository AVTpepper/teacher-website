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

// ─── Types ────────────────────────────────────────────────────────────────────

type ValidSection = "objectives" | "materials" | "steps";

interface GenerateBody {
  mode: "generate";
  topic: string;
  gradeLevel: string;
  subject: string;
}

interface SuggestBody {
  mode: "suggest";
  gradeLevel: string;
  subject: string;
  section: ValidSection;
  existingContent?: string[];
}

type RequestBody = GenerateBody | SuggestBody;

// ─── OpenAI client (module-level lazy singleton) ──────────────────────────────
// OPENAI_API_KEY is read exclusively from process.env — never exported to the client.

let _openai: OpenAI | null | undefined; // undefined = not yet initialised

function getOpenAIClient(): OpenAI | null {
  if (_openai !== undefined) return _openai;
  const apiKey = process.env.OPENAI_API_KEY;
  _openai = apiKey ? new OpenAI({ apiKey }) : null;
  return _openai;
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<Response> {
  // 1. Auth guard — require a valid Firebase ID token in the Authorization header
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

  // 2. OpenAI availability check — return 503, never crash
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
  if (raw.mode !== "generate" && raw.mode !== "suggest") {
    return Response.json(
      {
        error:
          'Field "mode" is required and must be "generate" or "suggest".',
      },
      { status: 400 },
    );
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
  } else {
    const VALID_SECTIONS: ValidSection[] = [
      "objectives",
      "materials",
      "steps",
    ];
    if (
      !raw.section ||
      typeof raw.section !== "string" ||
      !VALID_SECTIONS.includes(raw.section as ValidSection)
    ) {
      return Response.json(
        {
          error:
            'Field "section" is required for mode "suggest" and must be "objectives", "materials", or "steps".',
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
      (raw.existingContent as string[]).some((item) => item.length > 100)
    ) {
      return Response.json(
        { error: 'Each item in "existingContent" must be 100 characters or fewer.' },
        { status: 400 },
      );
    }
  }

  const body = raw as unknown as RequestBody;

  // 6. Build prompts and call OpenAI
  let systemPrompt: string;
  let userMessage: string;

  if (body.mode === "generate") {
    systemPrompt = `You are an expert educator. Given a topic, grade level, and subject, return a complete lesson plan as a single JSON object with exactly this structure:
{
  "title": "<string>",
  "objectives": ["<string>"],
  "materials": ["<string>"],
  "steps": ["<string>"]
}
Return only the raw JSON object — no markdown, no code fences, no explanation.`;

    userMessage = `Create a lesson plan for:
Topic: ${body.topic}
Grade Level: ${body.gradeLevel}
Subject: ${body.subject}`;
  } else {
    systemPrompt = `You are an expert educator. Given a lesson section name and its current content, return improved or alternative items for that section as a JSON object with exactly this structure:
{
  "suggestions": ["<string>", "<string>"]
}
Return only the raw JSON object — no markdown, no code fences, no explanation.`;

    const existing =
      body.existingContent && body.existingContent.length > 0
        ? JSON.stringify(body.existingContent)
        : "(none provided)";

    userMessage = `Improve the "${body.section}" section for:
Grade Level: ${body.gradeLevel}
Subject: ${body.subject}
Current content: ${existing}`;
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
      const lesson = parsed as Record<string, unknown>;
      if (
        typeof lesson.title !== "string" ||
        !Array.isArray(lesson.objectives) ||
        !Array.isArray(lesson.materials) ||
        !Array.isArray(lesson.steps)
      ) {
        return Response.json(
          {
            error:
              "The AI returned an unexpected format. Please try again.",
          },
          { status: 502 },
        );
      }
      return Response.json({
        lesson: {
          title: lesson.title,
          objectives: lesson.objectives as string[],
          materials: lesson.materials as string[],
          steps: lesson.steps as string[],
        },
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
      return Response.json({ suggestions: data.suggestions as string[] });
    }
  } catch (err: unknown) {
    // Map all OpenAI SDK errors to safe, human-readable messages — no raw objects in responses
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
