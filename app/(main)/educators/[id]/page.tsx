import type { Metadata } from "next";
import EducatorProfile from "@/components/educators/EducatorProfile";
import {
  getFirebaseAdminDb,
  isFirebaseAdminConfigured,
} from "@/lib/server/firebaseAdmin";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const canonicalPath = `/educators/${id}`;

  const fallback: Metadata = {
    title: "Educator Profile | VistaTeacher",
    description: "Explore educator profiles, shared resources, and professional contributions on VistaTeacher.",
    alternates: {
      canonical: canonicalPath,
    },
  };

  if (!isFirebaseAdminConfigured()) {
    return fallback;
  }

  try {
    const snap = await getFirebaseAdminDb().collection("users").doc(id).get();
    if (!snap.exists) {
      return {
        ...fallback,
        title: "Educator Not Found | VistaTeacher",
      };
    }

    const data = snap.data() as {
      displayName?: string;
      professionalHeadline?: string;
      professionalRole?: string;
      bio?: string;
    };

    const name = data.displayName?.trim() || "Educator";
    const headline = data.professionalHeadline?.trim() || data.professionalRole?.trim() || "Professional educator";
    const description = data.bio?.trim() || `${headline} on VistaTeacher.`;

    return {
      title: `${name} | VistaTeacher`,
      description,
      alternates: {
        canonical: canonicalPath,
      },
      openGraph: {
        title: `${name} | VistaTeacher`,
        description,
        type: "profile",
        url: canonicalPath,
      },
      twitter: {
        card: "summary",
        title: `${name} | VistaTeacher`,
        description,
      },
    };
  } catch {
    return fallback;
  }
}

export default async function EducatorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EducatorProfile userId={id} />;
}
