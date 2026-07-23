import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Input from "@/components/ui/Input";

describe("Input", () => {
  it("associates label and input by id", () => {
    render(<Input id="email" label="Email" type="email" />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("id", "email");
  });

  it("announces error through aria attributes", () => {
    render(<Input id="name" label="Name" error="Name is required" />);

    const input = screen.getByLabelText("Name");
    const error = screen.getByRole("alert");

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "name-error");
    expect(error).toHaveAttribute("id", "name-error");
  });
});
