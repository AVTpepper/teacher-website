import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import EmptyState from "@/components/ui/EmptyState";

describe("EmptyState", () => {
  it("renders content and action callback", async () => {
    const onAction = vi.fn();

    render(
      <EmptyState
        title="No resources yet"
        description="Create your first shared resource."
        actionLabel="Create resource"
        onAction={onAction}
      />
    );

    expect(screen.getByRole("heading", { name: "No resources yet" })).toBeInTheDocument();
    expect(screen.getByText("Create your first shared resource.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Create resource" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
