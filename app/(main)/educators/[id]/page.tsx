"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  getUser,
  followUser,
  unfollowUser,
  isFollowing as checkIsFollowing,
  type UserProfile,
} from "@/lib/firestore/users";
import { Avatar, Badge, Button, Card, Tabs, Tag } from "@/components/ui";

const PROFILE_TABS = [
  { label: "Posts", value: "posts" },
  { label: "Resources Shared", value: "resources" },
  { label: "Lessons Created", value: "lessons" },
  { label: "Discussions", value: "discussions" },
];

export default function EducatorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState("posts");
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // Redirect to own profile page if viewing yourself
  const isOwnProfile = user?.uid === id;

  useEffect(() => {
    async function load() {
      try {
        const data = await getUser(id);
        if (!data) {
          setNotFound(true);
        } else {
          setProfile(data);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // Check follow status
  useEffect(() => {
    if (!user || !id || isOwnProfile) return;
    checkIsFollowing(user.uid, id).then(setFollowing).catch(() => {});
  }, [user, id, isOwnProfile]);

  async function handleFollowToggle() {
    if (!user || !profile) return;
    setFollowLoading(true);
    try {
      if (following) {
        await unfollowUser(user.uid, profile.uid);
        setFollowing(false);
        setProfile((p) =>
          p ? { ...p, followerCount: Math.max(0, p.followerCount - 1) } : p
        );
      } else {
        await followUser(user.uid, profile.uid);
        setFollowing(true);
        setProfile((p) =>
          p ? { ...p, followerCount: p.followerCount + 1 } : p
        );
      }
    } catch {
      // Silently fail — could show toast in future
    } finally {
      setFollowLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-2xl font-bold text-foreground">
          Educator Not Found
        </h1>
        <p className="mt-2 text-sm text-muted">
          This profile doesn&apos;t exist or has been removed.
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => router.push("/educators")}
        >
          Browse Educators
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl py-8">
      {/* Profile Header */}
      <Card padding="lg">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          {/* Avatar */}
          <Avatar
            src={profile.photoURL}
            alt={profile.displayName}
            size="xl"
            className="h-24! w-24! text-2xl!"
          />

          {/* Info */}
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-col items-center gap-2 sm:flex-row">
              <h1 className="text-2xl font-bold text-foreground">
                {profile.displayName}
              </h1>
              {profile.isVerified && (
                <Badge variant="success">
                  <span className="flex items-center gap-1">
                    <svg
                      className="h-3 w-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Verified
                  </span>
                </Badge>
              )}
            </div>

            {/* Meta row */}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-muted sm:justify-start">
              {profile.gradeLevel && (
                <span className="flex items-center gap-1">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342"
                    />
                  </svg>
                  {profile.gradeLevel}
                </span>
              )}
              {profile.school && (
                <span className="flex items-center gap-1">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 7.5h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z"
                    />
                  </svg>
                  {profile.school}
                </span>
              )}
              {profile.location && (
                <span className="flex items-center gap-1">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0 1 15 0Z"
                    />
                  </svg>
                  {profile.location}
                </span>
              )}
              {profile.yearsOfExperience > 0 && (
                <span className="flex items-center gap-1">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                    />
                  </svg>
                  {profile.yearsOfExperience} yr{profile.yearsOfExperience !== 1 && "s"} experience
                </span>
              )}
            </div>

            {/* Subjects */}
            {profile.subjects.length > 0 && (
              <div className="mt-3 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                {profile.subjects.map((s) => (
                  <Badge key={s} variant="primary">
                    {s}
                  </Badge>
                ))}
              </div>
            )}

            {/* Stats */}
            <div className="mt-4 flex items-center justify-center gap-6 text-sm sm:justify-start">
              <span>
                <strong className="text-foreground">
                  {profile.followerCount}
                </strong>{" "}
                <span className="text-muted">
                  {profile.followerCount === 1 ? "Follower" : "Followers"}
                </span>
              </span>
              <span>
                <strong className="text-foreground">
                  {profile.followingCount}
                </strong>{" "}
                <span className="text-muted">Following</span>
              </span>
            </div>

            {/* Bio */}
            {profile.bio && (
              <p className="mt-4 text-sm text-secondary-600">{profile.bio}</p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        {!authLoading && !isOwnProfile && (
          <div className="mt-6 flex items-center gap-3 border-t border-border pt-4">
            <Button
              variant={following ? "outline" : "primary"}
              isLoading={followLoading}
              onClick={handleFollowToggle}
            >
              {following ? "Following" : "Follow"}
            </Button>
            <Button variant="secondary" disabled>
              Message
            </Button>
          </div>
        )}

        {isOwnProfile && (
          <div className="mt-6 flex items-center gap-3 border-t border-border pt-4">
            <Button
              variant="outline"
              onClick={() => router.push("/profile/edit")}
            >
              Edit Profile
            </Button>
          </div>
        )}
      </Card>

      {/* Badges Section */}
      {profile.badges.length > 0 && (
        <Card className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Achievements
          </h2>
          <div className="flex flex-wrap gap-2">
            {profile.badges.map((badge) => (
              <Tag key={badge} label={badge} />
            ))}
          </div>
        </Card>
      )}

      {/* Content Tabs */}
      <div className="mt-6">
        <Tabs
          tabs={PROFILE_TABS}
          defaultValue="posts"
          onChange={setActiveTab}
        />
        <Card className="mt-4 min-h-50" padding="lg">
          {activeTab === "posts" && (
            <EmptyTabContent
              title="No Posts Yet"
              description={
                isOwnProfile
                  ? "Share your first post with the community."
                  : `${profile.displayName} hasn't posted yet.`
              }
            />
          )}
          {activeTab === "resources" && (
            <EmptyTabContent
              title="No Resources Shared"
              description={
                isOwnProfile
                  ? "Share a resource to help fellow educators."
                  : `${profile.displayName} hasn't shared resources yet.`
              }
            />
          )}
          {activeTab === "lessons" && (
            <EmptyTabContent
              title="No Lessons Created"
              description={
                isOwnProfile
                  ? "Create your first lesson plan."
                  : `${profile.displayName} hasn't created lessons yet.`
              }
            />
          )}
          {activeTab === "discussions" && (
            <EmptyTabContent
              title="No Discussions"
              description={
                isOwnProfile
                  ? "Start a discussion in the forums."
                  : `${profile.displayName} hasn't joined any discussions yet.`
              }
            />
          )}
        </Card>
      </div>
    </div>
  );
}

function EmptyTabContent({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <svg
        className="h-12 w-12 text-secondary-300"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
        />
      </svg>
      <h3 className="mt-3 text-sm font-medium text-foreground">{title}</h3>
      <p className="mt-1 text-xs text-muted">{description}</p>
    </div>
  );
}
