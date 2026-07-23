import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Avatar from "@/components/ui/Avatar";

describe("Avatar", () => {
  it("shows initials when no image source exists", () => {
    render(<Avatar alt="Jane Smith" size="md" />);
    expect(screen.getByText("JS")).toBeInTheDocument();
  });

  it("renders plus badge marker when plus flag is true", () => {
    render(<Avatar alt="User" size="sm" showPlusBadge isPlus />);
    expect(screen.getByLabelText("Plus member")).toBeInTheDocument();
  });
});
