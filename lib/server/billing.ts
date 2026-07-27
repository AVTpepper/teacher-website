import { getFirebaseAdminDb } from "@/lib/server/firebaseAdmin";
import { getUserEntitlements, type BillingEntitlements } from "@/lib/billing/entitlements";
import type { UserProfile } from "@/lib/firestore/users";

function toBillingProfile(data: Record<string, unknown> | null, uid: string): UserProfile | null {
  if (!data) return null;

  return {
    uid,
    displayName: typeof data.displayName === "string" ? data.displayName : "",
    email: typeof data.email === "string" ? data.email : "",
    photoURL: typeof data.photoURL === "string" ? data.photoURL : null,
    gradeLevel: typeof data.gradeLevel === "string" ? data.gradeLevel : "",
    gradeLevels: Array.isArray(data.gradeLevels) ? (data.gradeLevels as string[]) : undefined,
    subjects: Array.isArray(data.subjects) ? (data.subjects as string[]) : [],
    professionalRole: typeof data.professionalRole === "string" ? data.professionalRole : "",
    additionalRoles: Array.isArray(data.additionalRoles) ? (data.additionalRoles as string[]) : undefined,
    professionalHeadline: typeof data.professionalHeadline === "string" ? data.professionalHeadline : "",
    curricula: Array.isArray(data.curricula) ? (data.curricula as string[]) : undefined,
    country: typeof data.country === "string" ? data.country : "",
    city: typeof data.city === "string" ? data.city : "",
    languages: Array.isArray(data.languages) ? (data.languages as string[]) : undefined,
    school: typeof data.school === "string" ? data.school : "",
    schoolType: typeof data.schoolType === "string" ? data.schoolType : undefined,
    yearsOfExperience: typeof data.yearsOfExperience === "number" ? data.yearsOfExperience : 0,
    bio: typeof data.bio === "string" ? data.bio : "",
    professionalInterests: Array.isArray(data.professionalInterests)
      ? (data.professionalInterests as string[])
      : undefined,
    networkingGoals: Array.isArray(data.networkingGoals) ? (data.networkingGoals as string[]) : undefined,
    lookingFor: typeof data.lookingFor === "string" ? data.lookingFor : undefined,
    onboardingCompleted: typeof data.onboardingCompleted === "boolean" ? data.onboardingCompleted : undefined,
    onboardingCompletedAt: data.onboardingCompletedAt,
    onboardingVersion: typeof data.onboardingVersion === "number" ? data.onboardingVersion : undefined,
    onboardingCurrentStep: typeof data.onboardingCurrentStep === "number" ? data.onboardingCurrentStep : undefined,
    profileCompletion: typeof data.profileCompletion === "number" ? data.profileCompletion : undefined,
    profileCardTheme:
      data.profileCardTheme === "classic" ||
      data.profileCardTheme === "ocean" ||
      data.profileCardTheme === "forest" ||
      data.profileCardTheme === "sunset" ||
      data.profileCardTheme === "midnight"
        ? data.profileCardTheme
        : undefined,
    isVerified: Boolean(data.isVerified),
    role: data.role === "admin" ? "admin" : "user",
    tier: data.tier === "plus" ? "plus" : "free",
    stripeCustomerId: typeof data.stripeCustomerId === "string" ? data.stripeCustomerId : undefined,
    stripeSubscriptionId:
      typeof data.stripeSubscriptionId === "string" ? data.stripeSubscriptionId : undefined,
    stripeSubscriptionStatus:
      typeof data.stripeSubscriptionStatus === "string" ? data.stripeSubscriptionStatus : undefined,
    stripeCurrentPeriodEnd:
      typeof data.stripeCurrentPeriodEnd === "number" ? data.stripeCurrentPeriodEnd : null,
    stripeCancelAt: typeof data.stripeCancelAt === "number" ? data.stripeCancelAt : null,
    stripeCancelAtPeriodEnd:
      typeof data.stripeCancelAtPeriodEnd === "boolean" ? data.stripeCancelAtPeriodEnd : undefined,
    stripeCanceledAt: typeof data.stripeCanceledAt === "number" ? data.stripeCanceledAt : null,
    stripeLastSyncedAt: data.stripeLastSyncedAt,
    billingStatus: typeof data.billingStatus === "string" ? data.billingStatus : undefined,
    updatedAt: data.updatedAt,
    deletionStatus: typeof data.deletionStatus === "string" ? data.deletionStatus : undefined,
    deletionRequestedAt: data.deletionRequestedAt,
    createdAt: data.createdAt ?? null,
    badges: Array.isArray(data.badges) ? (data.badges as string[]) : [],
    followerCount: typeof data.followerCount === "number" ? data.followerCount : 0,
    followingCount: typeof data.followingCount === "number" ? data.followingCount : 0,
  };
}

export async function getUserBillingEntitlements(uid: string): Promise<BillingEntitlements> {
  const db = getFirebaseAdminDb();
  const snap = await db.doc(`users/${uid}`).get();
  const profile = snap.exists ? toBillingProfile(snap.data() as Record<string, unknown>, uid) : null;
  return getUserEntitlements(profile);
}

export async function getBillingProfileSnapshot(uid: string): Promise<UserProfile | null> {
  const db = getFirebaseAdminDb();
  const snap = await db.doc(`users/${uid}`).get();
  return snap.exists ? toBillingProfile(snap.data() as Record<string, unknown>, uid) : null;
}