import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import LandingPage from "@/components/landing/LandingPage";

const mockUseAuth = vi.fn();
const mockSearchEducators = vi.fn();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/lib/firestore/users", () => ({
  searchEducators: (...args: unknown[]) => mockSearchEducators(...args),
}));

describe("LandingPage", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockSearchEducators.mockReset();
    mockUseAuth.mockReturnValue({ user: null, loading: false });
  });

  it("shows signup primary CTA for signed-out users", async () => {
    mockSearchEducators.mockResolvedValue({ educators: [], lastDoc: null });

    render(<LandingPage />);

    await waitFor(() => {
      expect(mockSearchEducators).toHaveBeenCalledTimes(1);
    });

    expect(screen.getAllByRole("link", { name: "Create Your Free Profile" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Join VistaTeacher - It is Free" })).toHaveAttribute("href", "/auth/signup");
  });

  it("shows dashboard primary CTA for authenticated users", async () => {
    mockUseAuth.mockReturnValue({ user: { uid: "u-1" }, loading: false });
    mockSearchEducators.mockResolvedValue({ educators: [], lastDoc: null });

    render(<LandingPage />);

    await waitFor(() => {
      expect(mockSearchEducators).toHaveBeenCalledTimes(1);
    });

    expect(screen.getAllByRole("link", { name: "Go to Your Dashboard" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Explore Your Network" })).toHaveAttribute("href", "/educators");
  });

  it("renders error state when educator preview loading fails", async () => {
    mockSearchEducators.mockRejectedValue(new Error("network"));

    render(<LandingPage />);

    expect(await screen.findByText("We could not load educator previews right now. You can still explore Discover.")).toBeInTheDocument();
  });

  it("renders live educator preview cards when data is available", async () => {
    mockSearchEducators.mockResolvedValue({
      educators: [
        {
          uid: "edu-1",
          displayName: "Ava Patel",
          photoURL: null,
          gradeLevel: "Middle School",
          subjects: ["Math", "STEM"],
          country: "Canada",
          bio: "Curriculum and assessment educator.",
        },
      ],
      lastDoc: null,
    });

    render(<LandingPage />);

    expect(await screen.findAllByRole("link", { name: /Ava Patel/i })).toHaveLength(2);
  });
});
