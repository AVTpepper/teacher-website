import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PersonalizedDashboard from "@/components/dashboard/PersonalizedDashboard";
import type { UserProfile } from "@/lib/firestore/users";

const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockUseAuth = vi.fn();
const mockGetUser = vi.fn();
const mockGetFollowing = vi.fn();
const mockGetDiscoverCandidatePool = vi.fn();
const mockRankRecommendedEducators = vi.fn();
const mockIsRecommendationEligible = vi.fn();
const mockFetchConnectionStatuses = vi.fn();
const mockFetchNetworkSummary = vi.fn();
const mockFetchConnectionQuota = vi.fn();
const mockFetchMessageQuota = vi.fn();
const mockFetchConversations = vi.fn();
const mockFetchIncomingRequests = vi.fn();
const mockFetchAcceptedConnections = vi.fn();
const mockFetchSentRequests = vi.fn();
const mockGetCategories = vi.fn();
const mockGetThreads = vi.fn();
const mockGetResources = vi.fn();
const mockGetJobs = vi.fn();
const mockGetPosts = vi.fn();
const mockGetPost = vi.fn();
const mockGetNotifications = vi.fn();

const searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => "/home",
  useSearchParams: () => searchParams,
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/components/educators/discover/DiscoverEducatorCard", () => ({
  default: ({ educator }: { educator: { displayName: string } }) => (
    <div>
      <h3>{educator.displayName}</h3>
      <p>View Profile</p>
    </div>
  ),
}));

vi.mock("@/components/posts/PostCard", () => ({
  default: ({ post }: { post: { id: string; authorName: string } }) => (
    <div>
      <h3>{post.authorName}</h3>
      <p>{post.id}</p>
    </div>
  ),
}));

vi.mock("@/lib/firestore/users", async () => {
  const actual = await vi.importActual<typeof import("@/lib/firestore/users")>("@/lib/firestore/users");
  return {
    ...(actual as object),
    getUser: (...args: unknown[]) => mockGetUser(...args),
    followUser: vi.fn().mockResolvedValue(undefined),
    unfollowUser: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@/lib/firestore/follows", () => ({
  getFollowing: (...args: unknown[]) => mockGetFollowing(...args),
}));

vi.mock("@/lib/discover/search", () => ({
  getDiscoverCandidatePool: (...args: unknown[]) => mockGetDiscoverCandidatePool(...args),
}));

vi.mock("@/lib/discover/recommendations", async () => {
  const actual = await vi.importActual<typeof import("@/lib/discover/recommendations")>("@/lib/discover/recommendations");
  return {
    ...(actual as object),
    rankRecommendedEducators: (...args: unknown[]) => mockRankRecommendedEducators(...args),
    isRecommendationEligible: (...args: unknown[]) => mockIsRecommendationEligible(...args),
  };
});

vi.mock("@/lib/network/client", () => ({
  fetchConnectionQuota: (...args: unknown[]) => mockFetchConnectionQuota(...args),
  fetchConnectionStatuses: (...args: unknown[]) => mockFetchConnectionStatuses(...args),
  fetchIncomingRequests: (...args: unknown[]) => mockFetchIncomingRequests(...args),
  fetchAcceptedConnections: (...args: unknown[]) => mockFetchAcceptedConnections(...args),
  fetchSentRequests: (...args: unknown[]) => mockFetchSentRequests(...args),
  fetchNetworkSummary: (...args: unknown[]) => mockFetchNetworkSummary(...args),
}));

vi.mock("@/lib/messages/client", () => ({
  fetchConversations: (...args: unknown[]) => mockFetchConversations(...args),
  fetchMessageQuota: (...args: unknown[]) => mockFetchMessageQuota(...args),
}));

vi.mock("@/lib/firestore/forums", async () => {
  const actual = await vi.importActual<typeof import("@/lib/firestore/forums")>("@/lib/firestore/forums");
  return {
    ...(actual as object),
    getCategories: (...args: unknown[]) => mockGetCategories(...args),
    getThreads: (...args: unknown[]) => mockGetThreads(...args),
  };
});

vi.mock("@/lib/firestore/resources", async () => {
  const actual = await vi.importActual<typeof import("@/lib/firestore/resources")>("@/lib/firestore/resources");
  return {
    ...(actual as object),
    getResources: (...args: unknown[]) => mockGetResources(...args),
  };
});

vi.mock("@/lib/firestore/jobs", async () => {
  const actual = await vi.importActual<typeof import("@/lib/firestore/jobs")>("@/lib/firestore/jobs");
  return {
    ...(actual as object),
    getJobs: (...args: unknown[]) => mockGetJobs(...args),
  };
});

vi.mock("@/lib/firestore/posts", async () => {
  const actual = await vi.importActual<typeof import("@/lib/firestore/posts")>("@/lib/firestore/posts");
  return {
    ...(actual as object),
    getPosts: (...args: unknown[]) => mockGetPosts(...args),
    getPost: (...args: unknown[]) => mockGetPost(...args),
  };
});

vi.mock("@/lib/notifications", async () => {
  const actual = await vi.importActual<typeof import("@/lib/notifications")>("@/lib/notifications");
  return {
    ...(actual as object),
    getNotifications: (...args: unknown[]) => mockGetNotifications(...args),
    notifyNewFollower: vi.fn().mockResolvedValue(undefined),
  };
});

function buildProfile(overrides: Partial<UserProfile>): UserProfile {
  return {
    uid: "viewer-1",
    displayName: "Alex Rivera",
    email: "alex@example.com",
    photoURL: null,
    gradeLevel: "Elementary",
    gradeLevels: ["Elementary"],
    subjects: ["Math"],
    professionalRole: "Primary Teacher",
    additionalRoles: [],
    professionalHeadline: "Inquiry-first classroom teacher",
    curricula: ["IB PYP"],
    country: "Canada",
    city: "Toronto",
    languages: ["English"],
    school: "Vista School",
    schoolType: "Public",
    yearsOfExperience: 7,
    bio: "",
    professionalInterests: ["Inquiry-based learning"],
    networkingGoals: ["Find collaborators"],
    lookingFor: "",
    onboardingCompleted: true,
    onboardingVersion: 1,
    onboardingCurrentStep: 7,
    profileCompletion: 92,
    profileCardTheme: "classic",
    isVerified: false,
    createdAt: { seconds: 1000 },
    badges: [],
    followerCount: 4,
    followingCount: 2,
    tier: "free",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  searchParams.forEach((_, key) => searchParams.delete(key));

  mockUseAuth.mockReturnValue({
    user: {
      uid: "viewer-1",
      displayName: "Alex Rivera",
      photoURL: null,
      email: "alex@example.com",
      getIdToken: vi.fn().mockResolvedValue("token"),
    },
    loading: false,
  });

  mockGetUser.mockResolvedValue(buildProfile({}));
  mockGetFollowing.mockResolvedValue([]);
  mockGetDiscoverCandidatePool.mockResolvedValue([buildProfile({ uid: "candidate-1", displayName: "Candidate One" })]);
  mockRankRecommendedEducators.mockReturnValue([
    {
      educator: buildProfile({ uid: "candidate-1", displayName: "Candidate One" }),
      score: 12,
      matchLabel: "Good match",
      reasons: [{ id: "subjects", label: "Shared subjects: Math" }],
    },
  ]);
  mockIsRecommendationEligible.mockReturnValue(true);
  mockFetchConnectionStatuses.mockResolvedValue({ "candidate-1": { participantKey: "p1", status: "none" } });
  mockFetchNetworkSummary.mockResolvedValue({ connections: 2, incoming: 1, sent: 0, quota: { periodKey: "2026-07", isUnlimited: false, limit: 5, used: 1, remaining: 4, canSend: true } });
  mockFetchConnectionQuota.mockResolvedValue({ periodKey: "2026-07", isUnlimited: false, limit: 5, used: 1, remaining: 4, canSend: true });
  mockFetchMessageQuota.mockResolvedValue({ periodKey: "2026-07", isUnlimited: false, limit: 10, used: 2, remaining: 8, canSend: true });
  mockFetchConversations.mockResolvedValue([]);
  mockFetchIncomingRequests.mockResolvedValue([]);
  mockFetchAcceptedConnections.mockResolvedValue([]);
  mockFetchSentRequests.mockResolvedValue([]);
  mockGetCategories.mockResolvedValue([{ id: "lesson-planning", name: "Lesson Planning", description: "Tips and templates.", icon: "📋", threadCount: 4, lastActivityAt: null }]);
  mockGetThreads.mockResolvedValue({ threads: [{ id: "thread-1", categoryId: "lesson-planning", title: "Thread One", content: "Hello", authorId: "author-1", authorName: "Sam", authorPhotoURL: null, tags: [], gradeLevel: "Elementary", subject: "Math", links: [], createdAt: { seconds: 1000 }, updatedAt: { seconds: 1000 }, upvotes: 0, downvotes: 0, commentCount: 3 }], lastDoc: null });
  mockGetResources.mockResolvedValue({ resources: [{ id: "resource-1", title: "Resource One", description: "Desc", authorId: "author-1", authorName: "Sam", authorPhotoURL: null, gradeLevel: "Elementary", subject: "Math", type: "strategy", fileURL: "https://example.com", fileName: "file.pdf", downloadCount: 0, ratingSum: 0, ratingCount: 0, ratingAverage: 0, savedByCount: 0, createdAt: { seconds: 1000 }, isPublic: true, tags: [], links: [] }], lastDoc: null });
  mockGetJobs.mockResolvedValue({ jobs: [{ id: "job-1", title: "Job One", organization: "School One", location: "Canada", gradeLevel: "Elementary", subject: "Math", jobType: "full-time", description: "Desc", applyURL: "https://example.com", postedBy: "poster", createdAt: { seconds: 1000 }, isActive: true }], cursor: null });
  mockGetPosts.mockResolvedValue({ posts: [{ id: "post-1", authorId: "author-1", authorName: "Sam", authorPhotoURL: null, content: "Post content", type: "general", tags: [], gradeLevel: "Elementary", links: [], createdAt: { seconds: 1000 }, updatedAt: { seconds: 1000 }, likesCount: 0, commentCount: 0 }], lastDoc: null });
  mockGetPost.mockResolvedValue(null);
  mockGetNotifications.mockResolvedValue({ notifications: [{ id: "notif-1", recipientId: "viewer-1", type: "resource-shared", read: false, dismissed: false, createdAt: { seconds: 1000 }, actorId: "author-1", actorName: "Sam", actorPhotoURL: null, message: "Sam shared a resource.", linkURL: "/resources/resource-one" }], lastDoc: null });
});

describe("PersonalizedDashboard", () => {
  it("renders the personalized greeting and top attention item", async () => {
    render(<PersonalizedDashboard />);

    expect(await screen.findByRole("heading", { name: /Welcome back, Alex/ })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Needs your attention" })).toBeInTheDocument();
    expect(screen.getByText("Connection requests")).toBeInTheDocument();
    expect(screen.getByText("Candidate One")).toBeInTheDocument();
  });

  it("renders network and content modules from mocked data", async () => {
    render(<PersonalizedDashboard />);

    expect(await screen.findByRole("heading", { name: "Network summary" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Explore" })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Thread One")).toBeInTheDocument();
      expect(screen.getByText("Resource One")).toBeInTheDocument();
      expect(screen.getByText("Job One")).toBeInTheDocument();
    });
  });
});