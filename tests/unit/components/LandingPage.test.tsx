import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import LandingPage from "@/components/landing/LandingPage";

const mockUseAuth = vi.fn();
const fetchMock = vi.fn();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("LandingPage", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    fetchMock.mockReset();
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ educators: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  it("shows signup primary CTA for signed-out users", async () => {
    render(<LandingPage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith("/api/public/showcase", { cache: "no-store" });
    });

    expect(screen.getAllByRole("link", { name: "Create Your Profile" }).length).toBeGreaterThan(0);
  });

  it("shows dashboard primary CTA for authenticated users", async () => {
    mockUseAuth.mockReturnValue({ user: { uid: "u-1" }, loading: false });

    render(<LandingPage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getAllByRole("link", { name: "Go to Your Dashboard" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Explore Your Network" })).toHaveAttribute("href", "/educators");
  });

  it("renders error state when educator preview loading fails", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    render(<LandingPage />);

    expect(await screen.findByText("We could not load educator previews right now. You can still explore Discover.")).toBeInTheDocument();
  });

  it("renders live educator preview cards when data is available", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
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
      }),
    });

    render(<LandingPage />);

    expect(await screen.findAllByRole("link", { name: /Ava Patel/i })).toHaveLength(2);
  });
});
