import React from "react";
import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "./router.jsx";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";

const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const totals = (extra = {}) => ({ id: "admin-test", role: "admin", as_of: "2026-11-06T04:00:00Z", users: 20, active_users: 18, moderators: 3, published_traces: 40, published_tides: 6, pending: 7, open_reports: 4, ...extra });
function setup(path, summary = totals({ held_traces: 2, oldest_pending_at: new Date(Date.now() - 4 * 86400000).toISOString() })) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "test-access", refresh_token: "test-refresh", expires_at: Date.now() / 1000 + 3600 }));
  const fetcher = vi.fn(async (url) => {
    if (url === "/api/auth/me") return ok({ id: "admin-test", display_name: "Test Admin", role: "admin", email: "admin@example.test", status: "active" });
    if (url === "/api/dashboard") return ok(summary);
    return ok([]);
  });
  vi.stubGlobal("fetch", fetcher);
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
  return fetcher;
}

it("shows what needs an admin as three links with their counts", async () => {
  setup("/admin/dashboard");
  const strip = await screen.findByRole("region", { name: "Needs you" });
  const held = within(strip).getByRole("link", { name: /Held Traces/ });
  const reports = within(strip).getByRole("link", { name: /Open reports/ });
  const pending = within(strip).getByRole("link", { name: /Pending Traces/ });
  await waitFor(() => expect(held.textContent).toContain("2"));
  expect(held.getAttribute("href")).toBe("/admin/review?hold=only");
  expect(reports.getAttribute("href")).toBe("/admin/reports");
  expect(reports.textContent).toContain("4");
  expect(pending.getAttribute("href")).toBe("/admin/review");
  expect(pending.textContent).toContain("7");
  expect(pending.textContent).toContain("Longest wait: 4 days");
});

it("replaces the old shortcut buttons and keeps the totals", async () => {
  setup("/admin/dashboard");
  await screen.findByRole("region", { name: "Needs you" });
  for (const name of ["Manage users", "Add moderator", "Publish Tides", "Moderation history"]) expect(screen.queryByRole("button", { name })).toBeNull();
  expect(screen.queryByRole("heading", { name: "Quick actions" })).toBeNull();
  expect(screen.getByRole("region", { name: "Dashboard totals" })).toBeTruthy();
  expect(screen.getByText(/Welcome, Test Admin/)).toBeTruthy();
});

it("marks held Traces as not available when the database has no held total yet", async () => {
  setup("/admin/dashboard", totals());
  const strip = await screen.findByRole("region", { name: "Needs you" });
  const held = within(strip).getByRole("link", { name: /Held Traces/ });
  await waitFor(() => expect(held.textContent).toContain("Not available"));
  expect(within(strip).getByRole("link", { name: /Open reports/ }).textContent).toContain("4");
});

it("says nothing is waiting when the queue is empty", async () => {
  setup("/admin/dashboard", totals({ pending: 0, held_traces: 0, oldest_pending_at: null }));
  const strip = await screen.findByRole("region", { name: "Needs you" });
  await waitFor(() => expect(within(strip).getByRole("link", { name: /Pending Traces/ }).textContent).toContain("Nothing is waiting"));
});

it("opens the review queue already filtered to held Traces", async () => {
  const fetcher = setup("/admin/review?hold=only");
  await screen.findByRole("group", { name: "Filter by hold" });
  expect(screen.getByRole("button", { name: "On hold" }).getAttribute("aria-pressed")).toBe("true");
  await waitFor(() => expect(fetcher.mock.calls.some(([url]) => url.startsWith("/api/moderation/traces?status=pending") && url.includes("hold=only"))).toBe(true));
  fireEvent.click(screen.getByRole("button", { name: "All pending" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "All pending" }).getAttribute("aria-pressed")).toBe("true"));
});
