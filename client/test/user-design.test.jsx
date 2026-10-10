import React from "react";
import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";

const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
function setup(path) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "test-access", refresh_token: "test-refresh", expires_at: Date.now() / 1000 + 3600 }));
  const fetcher = vi.fn(async (url) => {
    if (url === "/api/auth/me") return ok({ id: "member", display_name: "Test Member", role: "user", status: "active" });
    if (url === "/api/categories") return ok([{ id: "coral", name: "Coral condition" }]);
    if (url.startsWith("/api/traces?")) return ok([{ id: "reef", title: "Reef survey", status: "approved", category: { name: "Coral condition" }, author: { display_name: "Ana" }, location_name: "Lawis coast" }]);
    if (url.startsWith("/api/contributions?")) return ok([{ id: "draft", title: "My coast", status: "draft", category: { name: "Coral condition" }, location_name: "Lawis coast" }]);
    return ok([]);
  });
  vi.stubGlobal("fetch", fetcher);
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
  return fetcher;
}

it("moves between upload sections without losing details or saving early", async () => {
  const fetcher = setup("/user/traces/upload");
  await screen.findByRole("option", { name: "Coral condition" });
  fireEvent.change(screen.getByLabelText("Category (required)"), { target: { value: "coral" } });
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Reef visit" } });
  fireEvent.change(screen.getByLabelText("Location"), { target: { value: "Lawis" } });
  fireEvent.click(screen.getByRole("button", { name: /Review & submit/ }));
  const review = screen.getByRole("region", { name: "Review submission" });
  expect(document.activeElement).toBe(review);
  expect(within(review).getByText("Reef visit")).toBeTruthy();
  expect(within(review).getByText("Lawis")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Add description/ }));
  expect(screen.getByLabelText("Title").value).toBe("Reef visit");
  expect(fetcher.mock.calls.every(([, options]) => !options?.method || options.method === "GET")).toBe(true);
  expect(screen.getByRole("link", { name: "Traces", exact: true }).getAttribute("aria-current")).toBe("page");
});

it("makes archive cards accessible links to the saved trace", async () => {
  setup("/user/traces");
  const card = await screen.findByRole("link", { name: /Reef survey/ });
  expect(card.getAttribute("href")).toBe("/user/traces/reef");
  expect(within(card).getByText("Ana")).toBeTruthy();
  expect(within(card).getByText("Lawis coast")).toBeTruthy();
});

it("links contribution rows to their saved details with their actual status", async () => {
  setup("/user/contributions");
  const row = await screen.findByRole("link", { name: /My coast/ });
  expect(row.getAttribute("href")).toBe("/user/contributions/draft");
  expect(within(row).getByText("Draft")).toBeTruthy();
});

it("keeps user settings navigation and available controls functional", async () => {
  setup("/user/profile");
  await screen.findByRole("form", { name: "Basic information" });
  expect(screen.getByLabelText("Full name").value).toBe("Test Member");
  fireEvent.click(screen.getByRole("button", { name: "Privacy" }));
  expect(screen.getByRole("heading", { name: "Privacy preferences" })).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "Preference unavailable" }).every(button => button.disabled)).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "App settings" }));
  fireEvent.click(screen.getByRole("button", { name: "Turn on dark mode" }));
  expect(screen.getByRole("button", { name: "Turn off dark mode" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Turn off dark mode" }));
  fireEvent.click(screen.getByRole("button", { name: "Security" }));
  expect(screen.getByRole("heading", { name: "Account security" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Reset password" }).getAttribute("href")).toBe("/forgot-password");
  fireEvent.click(screen.getByRole("button", { name: "Usage & activity" }));
  expect(screen.getByRole("heading", { name: "Usage & activity" })).toBeTruthy();
});
