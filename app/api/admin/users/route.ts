import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/apiAuth";
import { adminAuth, adminDb } from "@/lib/server/firebaseAdmin";

type UserListItem = {
  uid: string;
  displayName: string;
  email: string;
  tier: "free" | "plus";
  role: "user" | "admin";
  disabled: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
};

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const date = (value as { toDate: () => Date }).toDate();
    return date.toISOString();
  }
  return null;
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    await requireAdmin(request);

    const limit = Math.min(
      Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "100", 10) || 100,
      200,
    );

    const usersSnap = await adminDb
      .collection("users")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    const uids = usersSnap.docs.map((doc) => doc.id);
    const authRecords = uids.length > 0 ? await adminAuth.getUsers(uids.map((uid) => ({ uid }))) : { users: [] };
    const authByUid = new Map(authRecords.users.map((u) => [u.uid, u]));

    const users: UserListItem[] = usersSnap.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const authRecord = authByUid.get(doc.id);
      const tier = data.tier === "plus" ? "plus" : "free";
      const role = data.role === "admin" ? "admin" : "user";

      return {
        uid: doc.id,
        displayName:
          (typeof data.displayName === "string" && data.displayName) ||
          authRecord?.displayName ||
          "",
        email: (typeof data.email === "string" && data.email) || authRecord?.email || "",
        tier,
        role,
        disabled: authRecord?.disabled ?? false,
        createdAt: toIsoDate(data.createdAt) ?? null,
        lastSignInAt: authRecord?.metadata.lastSignInTime ?? null,
      };
    });

    return Response.json({ users });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    if (err instanceof Error && err.message === "FORBIDDEN") {
      return Response.json({ error: "Admin access required." }, { status: 403 });
    }

    return Response.json({ error: "Failed to load users." }, { status: 500 });
  }
}
