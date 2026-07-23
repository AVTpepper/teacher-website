import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EducatorProfile from "@/components/educators/EducatorProfile";
import type { UserProfile } from "@/lib/firestore/users";

const mockPush = vi.fn();
const mockUseAuth = vi.fn();
const mockGetUser = vi.fn();
const mockFollowUser = vi.fn();
const mockUnfollowUser = vi.fn();
const mockCheckIsFollowing = vi.fn();

const mockGetLessonsByAuthor = vi.fn();
const mockGetLessonCountByAuthor = vi.fn();
const mockGetPostsByAuthor = vi.fn();
const mockGetPostCountByAuthor = vi.fn();
const mockGetResourcesByAuthor = vi.fn();
const mockGetResourceCountByAuthor = vi.fn();
const mockGetThreadsByAuthor = vi.fn();
const mockGetThreadCountByAuthor = vi.fn();
const mockFetchConnectionStatuses = vi.fn();
const mockFetchConnectionQuota = vi.fn();
const mockSendConnectionRequest = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/lib/firestore/users", async () => {
  const actual = await vi.importActual("@/lib/firestore/users");
  return {
    ...(actual as object),
    getUser: (...args: unknown[]) => mockGetUser(...args),
    followUser: (...args: unknown[]) => mockFollowUser(...args),
    unfollowUser: (...args: unknown[]) => mockUnfollowUser(...args),
    isFollowing: (...args: unknown[]) => mockCheckIsFollowing(...args),
  };
});

vi.mock("@/lib/firestore/lessons", async () => {
  const actual = await vi.importActual("@/lib/firestore/lessons");
  return {
    ...(actual as object),
    getLessonsByAuthor: (...args: unknown[]) => mockGetLessonsByAuthor(...args),
    getLessonCountByAuthor: (...args: unknown[]) => mockGetLessonCountByAuthor(...args),
  };
});

vi.mock("@/lib/firestore/posts", async () => {
  const actual = await vi.importActual("@/lib/firestore/posts");
  return {
    ...(actual as object),
    getPostsByAuthor: (...args: unknown[]) => mockGetPostsByAuthor(...args),
    getPostCountByAuthor: (...args: unknown[]) => mockGetPostCountByAuthor(...args),
  };
});

vi.mock("@/lib/firestore/resources", async () => {
  const actual = await vi.importActual("@/lib/firestore/resources");
  return {
    ...(actual as object),
    getResourcesByAuthor: (...args: unknown[]) => mockGetResourcesByAuthor(...args),
    getResourceCountByAuthor: (...args: unknown[]) => mockGetResourceCountByAuthor(...args),
  };
});

vi.mock("@/lib/firestore/forums", async () => {
  const actual = await vi.importActual("@/lib/firestore/forums");
  return {
    ...(actual as object),
    getThreadsByAuthor: (...args: unknown[]) => mockGetThreadsByAuthor(...args),
    getThreadCountByAuthor: (...args: unknown[]) => mockGetThreadCountByAuthor(...args),
  };
});

vi.mock("@/components/badges/BadgeIcon", () => ({
  BadgeList: ({ badgeIds }: { badgeIds: string[] }) => <div>Badges: {badgeIds.join(",")}</div>,
}));

vi.mock("@/lib/notifications", () => ({
  notifyNewFollower: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/network/client", () => ({
  fetchConnectionStatuses: (...args: unknown[]) => mockFetchConnectionStatuses(...args),
  fetchConnectionQuota: (...args: unknown[]) => mockFetchConnectionQuota(...args),
  sendConnectionRequest: (...args: unknown[]) => mockSendConnectionRequest(...args),
  ConnectionClientError: class ConnectionClientError extends Error {
    constructor(message: string, readonly code?: string) {
      super(message);
      this.name = "ConnectionClientError";
    }
  },
}));

vi.mock("@/components/ui", () => ({
  Avatar: ({ src, alt }: { src?: string | null; alt: string }) =>
    src ? <div data-testid="avatar-image">{alt}</div> : <div data-testid="avatar-fallback">{alt}</div>,
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Button: ({ children, onClick, disabled, isLoading }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; isLoading?: boolean }) => (
    <button type="button" onClick={onClick} disabled={disabled || isLoading}>
      {children}
    </button>
  ),
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tabs: ({ tabs, onChange }: { tabs: Array<{ label: string; value: string }>; onChange?: (value: string) => void }) => (
    <div>
      {tabs.map((tab) => (
        <button key={tab.value} type="button" onClick={() => onChange?.(tab.value)}>
          {tab.label}
        </button>
      ))}
    </div>
  ),
  Modal: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
}));

function buildProfile(overrides: Partial<UserProfile>): UserProfile {
  return {
    uid: "profile-1",
    displayName: "Avery Stone",
    email: "avery@example.com",
    photoURL: null,
    gradeLevel: "Elementary",
    gradeLevels: ["Elementary"],
    subjects: ["Math", "Science"],
    professionalRole: "Primary Teacher",
    additionalRoles: [],
    professionalHeadline: "Inquiry-driven classroom teacher",
    curricula: ["IB PYP"],
    country: "Canada",
    city: "Toronto",
    languages: ["English"],
    school: "Vista School",
    schoolType: "Public",
    yearsOfExperience: 6,
    bio: "Building creative, collaborative classrooms.",
    professionalInterests: ["Inquiry-based learning"],
    networkingGoals: ["Connect with educators"],
    lookingFor: "Collaborators for interdisciplinary projects.",
    onboardingCompleted: true,
    onboardingVersion: 1,
    onboardingCurrentStep: 7,
    profileCompletion: 60,
    isVerified: true,
    tier: "plus",
    createdAt: null,
    badges: [],
    followerCount: 5,
    followingCount: 3,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  mockUseAuth.mockReturnValue({
    user: {
      uid: "profile-1",
      displayName: "Avery Stone",
      photoURL: null,
      getIdToken: vi.fn().mockResolvedValue("token"),
    },
    loading: false,
  });

  mockFetchConnectionStatuses.mockResolvedValue({
    "profile-1": { participantKey: "pk", status: "none" },
  });
  mockFetchConnectionQuota.mockResolvedValue({
    periodKey: "2026-07",
    isUnlimited: false,
    limit: 5,
    used: 0,
    remaining: 5,
    canSend: true,
  });
  mockSendConnectionRequest.mockResolvedValue({ participantKey: "pk", status: "outgoing-pending" });

  mockCheckIsFollowing.mockResolvedValue(false);

  mockGetPostCountByAuthor.mockResolvedValue(0);
  mockGetResourceCountByAuthor.mockResolvedValue(0);
  mockGetLessonCountByAuthor.mockResolvedValue(0);
  mockGetThreadCountByAuthor.mockResolvedValue(0);

  mockGetPostsByAuthor.mockResolvedValue({ posts: [] });
  mockGetResourcesByAuthor.mockResolvedValue({ resources: [] });
  mockGetLessonsByAuthor.mockResolvedValue({ lessons: [] });
  mockGetThreadsByAuthor.mockResolvedValue({ threads: [] });

  mockGetUser.mockImplementation(async (uid: string) => {
    if (uid === "profile-1") return buildProfile({ uid: "profile-1" });
    return buildProfile({
      uid: "viewer-1",
      gradeLevel: "Middle School",
      gradeLevels: ["Middle School"],
      subjects: ["History"],
      curricula: ["Cambridge"],
      professionalInterests: ["Leadership"],
      networkingGoals: ["Find a mentor"],
      country: "Spain",
      city: "Madrid",
    });
  });
});

describe("EducatorProfile", () => {
  it("shows owner controls and owner-only completion prompt", async () => {
    render(<EducatorProfile userId="profile-1" />);

    expect(await screen.findByRole("heading", { name: "Avery Stone" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Profile" })).toBeInTheDocument();
    expect(screen.getByText(/Complete your professional profile/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Follow" })).not.toBeInTheDocument();
  });

  it("shows follow controls for visitors and hides completion prompt", async () => {
    mockUseAuth.mockReturnValue({
      user: {
        uid: "viewer-1",
        displayName: "Visitor",
        photoURL: null,
        getIdToken: vi.fn().mockResolvedValue("token"),
      },
      loading: false,
    });

    mockGetUser.mockImplementation(async (uid: string) => {
      if (uid === "profile-1") {
        return buildProfile({
          uid: "profile-1",
          profileCompletion: 40,
          gradeLevels: ["Middle School"],
          subjects: ["History"],
          curricula: ["Cambridge"],
          professionalInterests: ["Leadership"],
          networkingGoals: ["Find a mentor"],
          country: "Spain",
        });
      }
      return buildProfile({
        uid: "viewer-1",
        gradeLevel: "Middle School",
        gradeLevels: ["Middle School"],
        subjects: ["History"],
        curricula: ["Cambridge"],
        professionalInterests: ["Leadership"],
        networkingGoals: ["Find a mentor"],
        country: "Spain",
      });
    });

    render(<EducatorProfile userId="profile-1" />);

    expect(await screen.findByRole("button", { name: "Follow" })).toBeInTheDocument();
    expect(screen.queryByText(/Complete your professional profile/i)).not.toBeInTheDocument();
    expect(screen.getByText("Shared Context")).toBeInTheDocument();
  });

  it("renders avatar fallback when profile photo is missing", async () => {
    render(<EducatorProfile userId="profile-1" />);

    await screen.findByRole("heading", { name: "Avery Stone" });
    expect(screen.getByTestId("avatar-fallback")).toBeInTheDocument();
  });

  it("shows resources empty state on resources tab", async () => {
    render(<EducatorProfile userId="profile-1" />);

    await screen.findByRole("heading", { name: "Avery Stone" });
    await userEvent.click(screen.getByRole("button", { name: /Resources \(0\)/i }));

    expect(await screen.findByText("No Resources Shared")).toBeInTheDocument();
  });

  it("uses share fallback when share APIs are unavailable", async () => {
    const originalShare = navigator.share;
    const originalClipboard = navigator.clipboard;

    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });

    render(<EducatorProfile userId="profile-1" />);

    await screen.findByRole("heading", { name: "Avery Stone" });
    await userEvent.click(screen.getByRole("button", { name: "Share Profile" }));

    await waitFor(() => {
      expect(screen.getByText("Copy link from your browser address bar.")).toBeInTheDocument();
    });

    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: originalShare,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: originalClipboard,
    });
  });
});
