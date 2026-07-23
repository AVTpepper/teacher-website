import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ConnectionButton from "@/components/network/ConnectionButton";

describe("ConnectionButton", () => {
  it("opens request dialog from connect state", async () => {
    render(
      <ConnectionButton
        targetDisplayName="Sam"
        relationshipState="none"
        quota={null}
        onSendRequest={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Connect with Sam" }));
    expect(await screen.findByRole("heading", { name: "Why would you like to connect?" })).toBeInTheDocument();
  });

  it("renders respond state for incoming pending", () => {
    render(
      <ConnectionButton
        targetDisplayName="Sam"
        relationshipState="incoming-pending"
        quota={null}
        onSendRequest={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByRole("button", { name: "Respond to Sam connection request" })).toBeInTheDocument();
  });

  it("disables connect when monthly limit reached", () => {
    render(
      <ConnectionButton
        targetDisplayName="Sam"
        relationshipState="none"
        quota={{
          periodKey: "2026-07",
          isUnlimited: false,
          limit: 5,
          used: 5,
          remaining: 0,
          canSend: false,
        }}
        onSendRequest={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByRole("button", { name: "Monthly connection request limit reached" })).toBeDisabled();
  });
});
