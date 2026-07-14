import {
  collection,
  collectionGroup,
  query,
  where,
  getCountFromServer,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getUser, type UserProfileInput } from "@/lib/firestore/users";

// ---------------------------------------------------------------------------
// Badge definitions
// ---------------------------------------------------------------------------

export type BadgeId =
  // Verification
  | "verified"
  // Contribution
  | "resource-creator"
  | "lesson-builder"
  | "discussion-starter"
  | "community-helper"
  | "top-contributor"
  // Milestones
  | "first-resource"
  | "ten-lessons"
  | "hundred-downloads"
  | "hundred-replies"
  | "one-year-member"
  // Expertise
  | "math-mentor"
  | "literacy-specialist"
  | "stem-educator"
  | "classroom-management-expert"
  | "early-childhood-specialist";

export type BadgeColor =
  | "blue"
  | "green"
  | "purple"
  | "amber"
  | "teal"
  | "pink"
  | "gold"
  | "maroon";

export interface BadgeDefinition {
  id: BadgeId;
  label: string;
  icon: string;
  color: BadgeColor;
  description: string;
  category: "verification" | "contribution" | "milestone" | "expertise";
}

export const BADGE_DEFINITIONS: Record<BadgeId, BadgeDefinition> = {
  // --- Verification ---
  verified: {
    id: "verified",
    label: "Verified Educator",
    icon: "✓",
    color: "blue",
    description: "School credential verified by EduConnect.",
    category: "verification",
  },

  // --- Contribution ---
  "resource-creator": {
    id: "resource-creator",
    label: "Resource Creator",
    icon: "📂",
    color: "green",
    description: "Shared at least one resource with the community.",
    category: "contribution",
  },
  "lesson-builder": {
    id: "lesson-builder",
    label: "Lesson Builder",
    icon: "📝",
    color: "purple",
    description: "Created at least one lesson plan.",
    category: "contribution",
  },
  "discussion-starter": {
    id: "discussion-starter",
    label: "Discussion Starter",
    icon: "💬",
    color: "amber",
    description: "Started at least one forum discussion.",
    category: "contribution",
  },
  "community-helper": {
    id: "community-helper",
    label: "Community Helper",
    icon: "🤝",
    color: "teal",
    description: "Posted 10 or more comments across the platform.",
    category: "contribution",
  },
  "top-contributor": {
    id: "top-contributor",
    label: "Top Contributor",
    icon: "⭐",
    color: "gold",
    description: "Earned 3 or more contribution badges.",
    category: "contribution",
  },

  // --- Milestones ---
  "first-resource": {
    id: "first-resource",
    label: "First Resource Shared",
    icon: "🎉",
    color: "pink",
    description: "Uploaded your very first resource.",
    category: "milestone",
  },
  "ten-lessons": {
    id: "ten-lessons",
    label: "10 Lessons Created",
    icon: "🏆",
    color: "gold",
    description: "Created 10 or more lesson plans.",
    category: "milestone",
  },
  "hundred-downloads": {
    id: "hundred-downloads",
    label: "100 Resource Downloads",
    icon: "📥",
    color: "blue",
    description: "Your resources have been downloaded 100+ times.",
    category: "milestone",
  },
  "hundred-replies": {
    id: "hundred-replies",
    label: "100 Helpful Replies",
    icon: "💯",
    color: "green",
    description: "Posted 100 or more comments and replies.",
    category: "milestone",
  },
  "one-year-member": {
    id: "one-year-member",
    label: "1-Year Member",
    icon: "🎂",
    color: "purple",
    description: "Been a member of EduConnect for one full year.",
    category: "milestone",
  },

  // --- Expertise ---
  "math-mentor": {
    id: "math-mentor",
    label: "Math Mentor",
    icon: "🔢",
    color: "blue",
    description: "Math specialist educator.",
    category: "expertise",
  },
  "literacy-specialist": {
    id: "literacy-specialist",
    label: "Literacy Specialist",
    icon: "📚",
    color: "green",
    description: "Reading & writing specialist educator.",
    category: "expertise",
  },
  "stem-educator": {
    id: "stem-educator",
    label: "STEM Educator",
    icon: "🔬",
    color: "teal",
    description: "Science, Technology, Engineering & Math specialist.",
    category: "expertise",
  },
  "classroom-management-expert": {
    id: "classroom-management-expert",
    label: "Classroom Management Expert",
    icon: "🏫",
    color: "amber",
    description: "Classroom management specialist.",
    category: "expertise",
  },
  "early-childhood-specialist": {
    id: "early-childhood-specialist",
    label: "Early Childhood Specialist",
    icon: "🌱",
    color: "green",
    description: "Early childhood education specialist.",
    category: "expertise",
  },
};

export const BADGE_LIST = Object.values(BADGE_DEFINITIONS);

// ---------------------------------------------------------------------------
// getBadge - safely look up a badge definition by string id
// ---------------------------------------------------------------------------

export function getBadge(id: string): BadgeDefinition | undefined {
  return BADGE_DEFINITIONS[id as BadgeId];
}

// ---------------------------------------------------------------------------
// checkAndAwardBadges
//
// Fetches activity counts for the given user, computes which badges they have
// earned, persists any new ones to Firestore, and returns the newly awarded
// badge IDs.
//
// Call this after any action that could unlock a badge:
//   - Resource uploaded
//   - Lesson saved / published
//   - Forum thread created
//   - Comment / reply posted
// ---------------------------------------------------------------------------

export async function checkAndAwardBadges(uid: string): Promise<BadgeId[]> {
  if (!db) return [];

  const user = await getUser(uid);
  if (!user) return [];

  const existing = new Set<string>(user.badges);
  const toAdd: BadgeId[] = [];

  function earn(id: BadgeId) {
    if (!existing.has(id)) {
      existing.add(id);
      toAdd.push(id);
    }
  }

  // --- Activity counts (parallel) ---
  const [resourceSnap, lessonSnap, threadSnap] = await Promise.all([
    getCountFromServer(
      query(collection(db, "resources"), where("authorId", "==", uid))
    ),
    getCountFromServer(
      query(collection(db, "lessons"), where("authorId", "==", uid))
    ),
    getCountFromServer(
      query(
        collectionGroup(db, "threads"),
        where("authorId", "==", uid)
      )
    ),
  ]);

  const resourceCount = resourceSnap.data().count;
  const lessonCount = lessonSnap.data().count;
  const threadCount = threadSnap.data().count;

  // --- Contribution badges ---
  if (resourceCount >= 1) earn("resource-creator");
  if (lessonCount >= 1) earn("lesson-builder");
  if (threadCount >= 1) earn("discussion-starter");

  // --- Milestone badges ---
  if (resourceCount >= 1) earn("first-resource");
  if (lessonCount >= 10) earn("ten-lessons");

  // 1-year membership
  if (user.createdAt) {
    const createdMs =
      (user.createdAt as { seconds: number }).seconds * 1000;
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    if (Date.now() - createdMs >= oneYearMs) earn("one-year-member");
  }

  // --- Expertise badges (derived from profile subjects + grade level) ---
  const subjects = user.subjects ?? [];
  const grade = user.gradeLevel ?? "";

  if (subjects.includes("Math")) earn("math-mentor");

  if (subjects.some((s) => ["English", "Reading", "Writing"].includes(s)))
    earn("literacy-specialist");

  if (
    subjects.some((s) =>
      ["STEM", "Science", "Computer Science"].includes(s)
    )
  )
    earn("stem-educator");

  if (grade === "Kindergarten" || grade === "Elementary")
    earn("early-childhood-specialist");

  // --- Top contributor: 3+ contribution badges ---
  const contributionBadges: BadgeId[] = [
    "resource-creator",
    "lesson-builder",
    "discussion-starter",
    "community-helper",
  ];
  if (contributionBadges.filter((b) => existing.has(b)).length >= 3)
    earn("top-contributor");

  // --- Persist new badges ---
  if (toAdd.length > 0) {
    const allBadges = [...user.badges, ...toAdd];
    await updateDoc(doc(db, "users", uid), {
      badges: allBadges,
    } satisfies Partial<UserProfileInput & { badges: string[] }>);
  }

  return toAdd;
}

// ---------------------------------------------------------------------------
// awardBadge - manually award a single badge (e.g. "verified", "community-helper")
// ---------------------------------------------------------------------------

export async function awardBadge(uid: string, badge: BadgeId): Promise<void> {
  if (!db) return;
  const user = await getUser(uid);
  if (!user) return;
  if (user.badges.includes(badge)) return; // already has it

  await updateDoc(doc(db, "users", uid), {
    badges: [...user.badges, badge],
  });
}
