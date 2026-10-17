import React, { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PasswordField } from "../src/pages/auth/AuthLayout.jsx";

function Field({ newPassword = true }) {
  const [value, setValue] = useState("");
  return <PasswordField id="password" newPassword={newPassword} value={value} onChange={(event) => setValue(event.target.value)} />;
}

describe("password validation badge", () => {
  it("suppresses the native popup and clears the badge once corrected", async () => {
    const user = userEvent.setup();
    render(<Field />);
    const input = screen.getByLabelText("Password");
    await user.type(input, "short1");
    expect(fireEvent.invalid(input)).toBe(false);
    expect(screen.getByRole("alert").textContent).toBe("Use at least 8 characters");
    expect(input.getAttribute("aria-describedby")).toBe(screen.getByRole("alert").id);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    await user.type(input, "23");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(input.hasAttribute("aria-invalid")).toBe(false);
  });

  it("shows a required message for an empty password", () => {
    render(<Field />);
    expect(fireEvent.invalid(screen.getByLabelText("Password"))).toBe(false);
    expect(screen.getByRole("alert").textContent).toBe("Enter your password");
  });

  it("keeps login passwords free of registration length requirements", async () => {
    const user = userEvent.setup();
    render(<Field newPassword={false} />);
    await user.type(screen.getByLabelText("Password"), "short1");
    await user.tab();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
