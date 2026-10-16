import React from "react";
import { it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App.jsx";
function open(path) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: {} }) })));
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}
it.each([["/terms-of-service", "TideTrace Terms and Conditions"], ["/privacy-policy", "TideTrace Privacy Policy"]])("opens %s without signing in", async (path, title) => {
  open(path);
  expect(await screen.findByRole("heading", { level: 1, name: title })).toBeTruthy();
  expect(screen.getByText(/Draft for review/)).toBeTruthy();
  expect(screen.queryByText(/Publication notes/)).toBeNull();
  expect(document.title).not.toContain("Page not found");
});
it.each([
  ["Terms of Service", "TideTrace Terms and Conditions"],
  ["Privacy Policy", "TideTrace Privacy Policy"],
])("links from the home footer to %s", async (label, title) => {
  open("/");
  const footer = within(screen.getByRole("contentinfo"));
  fireEvent.click(footer.getByRole("link", { name: label }));
  expect(await screen.findByRole("heading", { level: 1, name: title })).toBeTruthy();
});
it("shows linked registration terms that open separately from the form", async () => {
  open("/register");
  const name = await screen.findByLabelText("Full name");
  fireEvent.change(name, { target: { value: "Member" } });
  const notice = screen.getByText(/By creating an account, you agree to our/);
  expect(within(notice).getByRole("link", { name: "Terms of Service" }).getAttribute("href")).toBe("/terms-of-service");
  const privacy = within(notice).getByRole("link", { name: "Privacy Policy" });
  expect(privacy.getAttribute("href")).toBe("/privacy-policy");
  expect(privacy.target).toBe("_blank");
  expect(name.value).toBe("Member");
});
