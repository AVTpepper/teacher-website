import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  followUser,
  unfollowUser,
  isFollowing,
  getUser,
  type UserProfile,
} from "@/lib/firestore/users";

export { followUser, unfollowUser, isFollowing };

/**
 * Returns the UserProfile for every user who follows `userId`.
 * Queries the `users/{userId}/followers` sub-collection (doc IDs are follower UIDs).
 */
export async function getFollowers(
  userId: string,
  limitN = 50
): Promise<UserProfile[]> {
  if (!db) throw new Error("Firestore is not initialized");

  const followersRef = collection(db, "users", userId, "followers");
  const q = query(followersRef, orderBy("followedAt", "desc"), limit(limitN));
  const snap = await getDocs(q);

  const followerUids = snap.docs.map((d) => d.id);
  if (followerUids.length === 0) return [];

  const profiles = await Promise.all(followerUids.map((uid) => getUser(uid)));
  return profiles.filter((p): p is UserProfile => p !== null);
}

/**
 * Returns the UserProfile for every user that `userId` follows.
 * Queries the `users/{userId}/following` sub-collection (doc IDs are followee UIDs).
 */
export async function getFollowing(
  userId: string,
  limitN = 50
): Promise<UserProfile[]> {
  if (!db) throw new Error("Firestore is not initialized");

  const followingRef = collection(db, "users", userId, "following");
  const q = query(followingRef, orderBy("followedAt", "desc"), limit(limitN));
  const snap = await getDocs(q);

  const followingUids = snap.docs.map((d) => d.id);
  if (followingUids.length === 0) return [];

  const profiles = await Promise.all(followingUids.map((uid) => getUser(uid)));
  return profiles.filter((p): p is UserProfile => p !== null);
}
