import { adminDb } from "@/lib/server/firebaseAdmin";

type PublicEducatorCard = {
  uid: string;
  displayName: string;
  photoURL: string | null;
  professionalRole: string;
  gradeLevel: string;
  country: string;
  subjects: string[];
  bio: string;
};

const EMPTY_RESPONSE = { educators: [] as PublicEducatorCard[] };

function toString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
}

export async function GET(): Promise<Response> {
  try {
    const snap = await adminDb.collection("users").orderBy("displayNameLower").limit(800).get();

    const educators = snap.docs
      .map((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        const displayName = toString(data.displayName);
        if (!displayName) return null;

        return {
          uid: docSnap.id,
          displayName,
          photoURL: toString(data.photoURL) || null,
          professionalRole: toString(data.professionalRole),
          gradeLevel: toString(data.gradeLevel),
          country: toString(data.country),
          subjects: toStringArray(data.subjects),
          bio: toString(data.bio),
        } satisfies PublicEducatorCard;
      })
      .filter((educator): educator is PublicEducatorCard => educator !== null);

    return Response.json({ educators });
  } catch {
    return Response.json(EMPTY_RESPONSE, { status: 200 });
  }
}
