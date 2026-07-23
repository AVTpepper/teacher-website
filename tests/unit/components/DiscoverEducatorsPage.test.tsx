import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DiscoverEducatorsPage from "@/components/educators/discover/DiscoverEducatorsPage";
import type { UserProfile } from "@/lib/firestore/users";

const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockUseAuth = vi.fn();
const mockGetUser = vi.fn();
const mockFollowUser = vi.fn();
const mockUnfollowUser = vi.fn();
const mockGetDocs = vi.fn();

const mockGetDiscoverCandidatePool = vi.fn();
const mockGetNewestDiscoverEducators = vi.fn();

const mockRankRecommendedEducators = vi.fn();
const mockIsRecommendationEligible = vi.fn();
const mockGetSharedContextReasons = vi.fn();
const mockFetchConnectionQuota = vi.fn();
const mockFetchConnectionStatuses = vi.fn();
const mockSendConnectionRequestApi = vi.fn();

const currentSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => "/discover",
  useSearchParams: () => currentSearchParams,
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));

vi.mock("@/lib/firestore/users", async () => {
  const actual = await vi.importActual("@/lib/firestore/users");
  return {
    ...(actual as object),
    getUser: (...args: unknown[]) => mockGetUser(...args),
    followUser: (...args: unknown[]) => mockFollowUser(...args),
    unfollowUser: (...args: unknown[]) => mockUnfollowUser(...args),
  };
});

vi.mock("@/lib/discover/search", () => ({
  getDiscoverCandidatePool: (...args: unknown[]) => mockGetDiscoverCandidatePool(...args),
  getNewestDiscoverEducators: (...args: unknown[]) => mockGetNewestDiscoverEducators(...args),
}));

vi.mock("@/lib/discover/recommendations", async () => {
  const actual = await vi.importActual("@/lib/discover/recommendations");
  return {
    ...(actual as object),
    rankRecommendedEducators: (...args: unknown[]) => mockRankRecommendedEducators(...args),
    isRecommendationEligible: (...args: unknown[]) => mockIsRecommendationEligible(...args),
  };
});

vi.mock("@/lib/profile/sharedContext", () => ({
  getSharedContextReasons: (...args: unknown[]) => mockGetSharedContextReasons(...args),
}));

vi.mock("@/lib/notifications", () => ({
  notifyNewFollower: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/network/client", () => ({
  fetchConnectionQuota: (...args: unknown[]) => mockFetchConnectionQuota(...args),
  fetchConnectionStatuses: (...args: unknown[]) => mockFetchConnectionStatuses(...args),
  sendConnectionRequest: (...args: unknown[]) => mockSendConnectionRequestApi(...args),
  ConnectionClientError: class ConnectionClientError extends Error {
    constructor(message: string, readonly code?: string) {
      super(message);
      this.name = "ConnectionClientError";
    }
  },
}));

function buildProfile(overrides: Partial<UserProfile>): UserProfile {
  return {
    uid: "u-1",
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
    profileCompletion: 90,
    isVerified: false,
    createdAt: { seconds: 1000 },
    badges: [],
    followerCount: 3,
    followingCount: 2,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  currentSearchParams.forEach((_, key) => currentSearchParams.delete(key));

  mockUseAuth.mockReturnValue({
    user: {
      uid: "viewer-1",
      displayName: "Viewer",
      photoURL: null,
      getIdToken: vi.fn().mockResolvedValue("token"),
    },
    loading: false,
  });

  const viewer = buildProfile({ uid: "viewer-1", displayName: "Viewer" });
  const candidate = buildProfile({ uid: "candidate-1", displayName: "Candidate One" });

  mockGetUser.mockResolvedValue(viewer);
  mockGetDocs.mockResolvedValue({ docs: [] });

  mockGetDiscoverCandidatePool.mockResolvedValue([candidate]);
  mockGetNewestDiscoverEducators.mockResolvedValue([]);
  mockIsRecommendationEligible.mockReturnValue(true);

  mockRankRecommendedEducators.mockReturnValue([
    {
      educator: candidate,
      score: 22,
      matchLabel: "Strong match",
      reasons: [{ id: "subjects", label: "Shared subjects: Math" }],
    },
  ]);

  mockGetSharedContextReasons.mockReturnValue([{ id: "subjects", label: "Shared", detail: "Shared subject: Math" }]);
  mockFollowUser.mockResolvedValue(undefined);
  mockUnfollowUser.mockResolvedValue(undefined);
  mockFetchConnectionQuota.mockResolvedValue({
    periodKey: "2026-07",
    isUnlimited: false,
    limit: 5,
    used: 0,
    remaining: 5,
    canSend: true,
  });
  mockFetchConnectionStatuses.mockResolvedValue({
    "candidate-1": { participantKey: "p1", status: "none" },
  });
  mockSendConnectionRequestApi.mockResolvedValue({ participantKey: "p1", status: "outgoing-pending" });
});

describe("DiscoverEducatorsPage", () => {
  it("renders discover heading and recommended section", async () => {
    render(<DiscoverEducatorsPage />);

    expect(await screen.findByRole("heading", { name: "Discover Educators" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Recommended for You" })).toBeInTheDocument();
    expect(screen.getAllByText("Candidate One").length).toBeGreaterThan(0);
  });

  it("loads URL state into search input", async () => {
    currentSearchParams.set("q", "math");

    render(<DiscoverEducatorsPage />);

    const input = await screen.findByLabelText("Search educators");
    expect(input).toHaveValue("math");
  });

  it("clears filters and resets URL state", async () => {
    currentSearchParams.set("subject", "Math");

    render(<DiscoverEducatorsPage />);

    await screen.findByRole("heading", { name: "All Educators" });
    await userEvent.click(screen.getByRole("button", { name: "Clear all" }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/discover", { scroll: false });
    });
  });

  it("shows empty state when no results match", async () => {
    currentSearchParams.set("q", "zzzz");
    mockGetDiscoverCandidatePool.mockResolvedValue([]);

    render(<DiscoverEducatorsPage />);

    expect(await screen.findByText("No educators matched your search.")).toBeInTheDocument();
  });

  it("follows educator from card", async () => {
    render(<DiscoverEducatorsPage />);

    const followButtons = await screen.findAllByRole("button", { name: "Follow" });
    await userEvent.click(followButtons[0]!);

    await waitFor(() => {
      expect(mockFollowUser).toHaveBeenCalled();
    });

    expect(mockPush).not.toHaveBeenCalledWith(
      expect.stringContaining("/auth/login"),
      expect.anything(),
    );
  });
});
