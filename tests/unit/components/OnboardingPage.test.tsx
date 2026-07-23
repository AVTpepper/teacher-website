import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OnboardingPage from "@/app/(main)/onboarding/page";

const mockReplace = vi.fn();
const mockPush = vi.fn();
const mockUseAuth = vi.fn();
const mockEnsureUserProfile = vi.fn();
const mockGetUser = vi.fn();
const mockUpdateUser = vi.fn();
const mockCreateUser = vi.fn();
const mockMarkOnboardingCompleted = vi.fn();
const mockUpdateProfile = vi.fn();
const mockRouter = { replace: mockReplace, push: mockPush };
const mockSearchParams = { get: vi.fn(() => null as string | null) };

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/onboarding",
  useSearchParams: () => mockSearchParams,
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => <span aria-label={String(props.alt || "image")} />,
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/lib/firestore/users", async () => {
  const actual = await vi.importActual("@/lib/firestore/users");
  return {
    ...(actual as object),
    ensureUserProfile: (...args: unknown[]) => mockEnsureUserProfile(...args),
    getUser: (...args: unknown[]) => mockGetUser(...args),
    updateUser: (...args: unknown[]) => mockUpdateUser(...args),
    createUser: (...args: unknown[]) => mockCreateUser(...args),
    markOnboardingCompleted: (...args: unknown[]) => mockMarkOnboardingCompleted(...args),
  };
});

vi.mock("firebase/auth", () => ({
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
}));

describe("OnboardingPage", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockPush.mockReset();
    mockUseAuth.mockReset();
    mockEnsureUserProfile.mockReset();
    mockGetUser.mockReset();
    mockUpdateUser.mockReset();
    mockCreateUser.mockReset();
    mockMarkOnboardingCompleted.mockReset();
    mockUpdateProfile.mockReset();
    mockSearchParams.get.mockReturnValue(null);

    mockUseAuth.mockReturnValue({
      user: {
        uid: "u-1",
        email: "alex@example.com",
        displayName: "Alex",
        photoURL: null,
      },
      loading: false,
    });

    const baseProfile = {
      uid: "u-1",
      displayName: "Alex",
      email: "alex@example.com",
      photoURL: null,
      gradeLevel: "",
      gradeLevels: [],
      subjects: [],
      professionalRole: "",
      additionalRoles: [],
      professionalHeadline: "",
      curricula: [],
      country: "",
      city: "",
      languages: [],
      school: "",
      schoolType: "",
      yearsOfExperience: 0,
      bio: "",
      professionalInterests: [],
      networkingGoals: [],
      lookingFor: "",
      onboardingCompleted: false,
      onboardingVersion: 0,
      onboardingCurrentStep: 1,
      profileCompletion: 0,
      badges: [],
      followerCount: 0,
      followingCount: 0,
      createdAt: null,
      isVerified: false,
    };

    mockGetUser.mockResolvedValue(baseProfile);
    mockEnsureUserProfile.mockResolvedValue(undefined);
    mockUpdateUser.mockResolvedValue(undefined);
    mockUpdateProfile.mockResolvedValue(undefined);
    mockCreateUser.mockResolvedValue(undefined);
    mockMarkOnboardingCompleted.mockResolvedValue(undefined);
  });

  it("loads step one and advances after required fields are set", async () => {
    render(<OnboardingPage />);

    expect(await screen.findByRole("heading", { name: "Professional identity" })).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText(/Primary professional role/i), "Primary Teacher");

    const continueButtons = screen.getAllByRole("button", { name: "Continue" });
    await userEvent.click(continueButtons[0]);

    expect(await screen.findByRole("heading", { name: "Teaching context" })).toBeInTheDocument();
    expect(mockUpdateUser).toHaveBeenCalled();
  });

  it("supports optional step skipping", async () => {
    mockGetUser.mockResolvedValue({
      uid: "u-1",
      displayName: "Alex",
      email: "alex@example.com",
      photoURL: null,
      gradeLevel: "Elementary",
      gradeLevels: ["Elementary"],
      subjects: ["Math"],
      professionalRole: "Primary Teacher",
      additionalRoles: [],
      professionalHeadline: "",
      curricula: [],
      country: "Canada",
      city: "",
      languages: [],
      school: "",
      schoolType: "",
      yearsOfExperience: 4,
      bio: "",
      professionalInterests: [],
      networkingGoals: ["Connect with educators"],
      lookingFor: "",
      onboardingCompleted: false,
      onboardingVersion: 1,
      onboardingCurrentStep: 4,
      profileCompletion: 70,
      badges: [],
      followerCount: 0,
      followingCount: 0,
      createdAt: null,
      isVerified: false,
    });

    render(<OnboardingPage />);

    expect(await screen.findByRole("heading", { name: "Professional interests" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    expect(await screen.findByRole("heading", { name: "Networking goals" })).toBeInTheDocument();
  });

  it("shows completion CTAs after finishing onboarding", async () => {
    mockGetUser.mockResolvedValue({
      uid: "u-1",
      displayName: "Alex",
      email: "alex@example.com",
      photoURL: null,
      gradeLevel: "Elementary",
      gradeLevels: ["Elementary"],
      subjects: ["Math"],
      professionalRole: "Primary Teacher",
      additionalRoles: [],
      professionalHeadline: "Teacher",
      curricula: ["IB PYP"],
      country: "Canada",
      city: "Toronto",
      languages: ["English"],
      school: "School",
      schoolType: "Public",
      yearsOfExperience: 4,
      bio: "I teach inquiry-based math and science in upper primary.",
      professionalInterests: ["Inquiry-based learning"],
      networkingGoals: ["Connect with educators"],
      lookingFor: "Looking for collaborators",
      onboardingCompleted: false,
      onboardingVersion: 1,
      onboardingCurrentStep: 7,
      profileCompletion: 88,
      badges: [],
      followerCount: 0,
      followingCount: 0,
      createdAt: null,
      isVerified: false,
    });

    render(<OnboardingPage />);

    expect(await screen.findByRole("heading", { name: "Completion" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Complete onboarding" }));

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Discover Educators" })).toHaveAttribute("href", "/discover");
      expect(screen.getByRole("link", { name: "View Your Profile" })).toHaveAttribute("href", "/profile");
    });
  });
});
