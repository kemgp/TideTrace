import React from "react";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";

const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
function setup(path, history = [], role = "admin") {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "test-access", refresh_token: "test-refresh", expires_at: Date.now() / 1000 + 3600 }));
  const fetcher = vi.fn(async (url) => {
    if (url === "/api/auth/me") return ok({ id: "admin-test", display_name: "Test Admin", role, email: "admin@example.test", status: "active" });
    if (url.startsWith("/api/moderation/history")) return ok(history);
    return ok([]);
  });
  vi.stubGlobal("fetch", fetcher);
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
  return fetcher;
}
// jsdom does not implement the browser's native dialog methods.
const originalShow = HTMLDialogElement.prototype.showModal;
const originalClose = HTMLDialogElement.prototype.close;
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterAll(() => {
  if (originalShow) HTMLDialogElement.prototype.showModal = originalShow; else delete HTMLDialogElement.prototype.showModal;
  if (originalClose) HTMLDialogElement.prototype.close = originalClose; else delete HTMLDialogElement.prototype.close;
});

it("navigates between the admin content, settings, and analytics screens", async () => {
  setup("/admin/dashboard");
  await screen.findByText(/Welcome, Test Admin/);
  fireEvent.click(screen.getByRole("link", { name: "Content" }));
  await screen.findByRole("heading", { name: "Topics & lessons" });
  fireEvent.click(screen.getByRole("link", { name: "Trace Categories" }));
  await screen.findByLabelText("New category name");
  fireEvent.click(screen.getByRole("link", { name: "Settings" }));
  await screen.findByRole("heading", { name: "Platform configuration" });
  fireEvent.click(screen.getByRole("link", { name: "Analytics" }));
  await screen.findByRole("heading", { name: "Platform analytics" });
  expect(screen.getByText(/Demo analytics/)).toBeTruthy();
});

it("loads the real moderator list without offering demo permission edits", async () => {
  const fetcher = setup("/admin/moderators");
  await screen.findByText("No accounts match these filters.");
  expect(screen.queryByText("Rica Lopez")).toBeNull();
  expect(screen.queryByText("Assign permissions")).toBeNull();
  expect(fetcher.mock.calls.some(([url]) => url.startsWith("/api/admin/users?") && url.includes("role=moderator"))).toBe(true);
});

it("filters saved history by decision and keeps trace links", async () => {
  setup("/admin/review/history", [
    { id: "decision-1", action: "review_trace", trace_id: "trace-1", trace: { title: "Approved reef" }, to_state: "approved", actor: { display_name: "Reviewer" }, created_at: "2026-09-27T00:00:00Z" },
    { id: "decision-2", action: "review_report", report: { trace: { title: "Dismissed report" } }, to_state: "dismissed", created_at: "2026-09-27T00:00:00Z" },
  ]);
  await screen.findByText("Approved reef");
  fireEvent.click(screen.getByRole("button", { name: "Approved" }));
  expect(screen.queryByText("Dismissed report")).toBeNull();
  expect(screen.getByRole("link", { name: "View trace" }).getAttribute("href")).toBe("/admin/review/trace-1");
  fireEvent.click(screen.getByRole("button", { name: "Dismissed" }));
  expect(screen.getByText("Dismissed report")).toBeTruthy();
  expect(screen.queryByText("Approved reef")).toBeNull();
});

it("labels settings as a preview and does not write platform settings", async () => {
  const fetcher = setup("/admin/settings?tab=app");
  await screen.findByRole("heading", { name: "Platform configuration" });
  const toggle = screen.getByRole("switch", { name: "Maintenance mode" });
  expect(toggle.getAttribute("aria-checked")).toBe("false");
  fireEvent.click(toggle);
  expect(toggle.getAttribute("aria-checked")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Apply preview" }));
  await screen.findByText(/Preview updated/);
  expect(fetcher.mock.calls.every(([, options]) => !options?.method || options.method === "GET")).toBe(true);
});

it.each(["/admin/settings", "/admin/analytics"])("keeps %s restricted to admins", async (path) => {
  setup(path, [], "user");
  await screen.findByText(/Kumusta/);
  expect(screen.queryByRole("heading", { name: "Platform configuration" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "Platform analytics" })).toBeNull();
});
