import React, { StrictMode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { MemoryRouter } from "./router.jsx";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";

const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const row = (id, status, extra = {}) => ({ id, title: `Trace ${id}`, author_id: "me", status, category: { id: "c", name: "Pollution" },
  location_name: "Coast", description: "x", created_at: "2026-10-20T00:00:00Z", updated_at: "2026-10-24T00:00:00Z", trace_media: [], version: 1, ...extra });
function Where() { const location = useLocation(); return <output data-testid="url">{location.pathname}{location.search}</output>; }
function setup(rows, path = "/user/contributions", totals = null) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "access", refresh_token: "refresh", expires_at: Date.now() / 1000 + 3600 }));
  const fetch = vi.fn(async (url, options = {}) => {
    if (url === "/api/auth/me") return ok({ id: "me", display_name: "Member", role: "user", status: "active", data_saver: true });
    if (options.method === "POST" && url === "/api/contributions/photo-cleanup") return { ok: true, status: 204 };
    if (totals && url === "/api/dashboard") return ok({ id: "me", role: "user", as_of: "2026-11-03T01:00:00Z", member_since: "2026-08-10T00:00:00Z", comments_posted: 0, tides_finished: 0, ...totals });
    if (url.startsWith("/api/contributions?")) return ok(typeof rows === "function" ? rows(url) : rows);
    return ok([]);
  });
  vi.stubGlobal("fetch", fetch);
  render(<StrictMode><MemoryRouter initialEntries={[path]}><Where /><App /></MemoryRouter></StrictMode>);
  return fetch;
}
const url = () => screen.getByTestId("url").textContent;
beforeEach(() => { sessionStorage.clear(); });

it("shows where each trace stands and how recently it changed", async () => {
  setup([row("d", "draft"), row("p", "pending"), row("a", "approved")]);
  await screen.findByText("Trace d");
  expect(screen.getByText("Not submitted yet")).toBeTruthy();
  expect(screen.getByText("Waiting for a reviewer")).toBeTruthy();
  expect(screen.getByText("Published")).toBeTruthy();
  expect(document.querySelectorAll(".contrib-state time").length).toBe(3);
});

it("shows one primary action per state, and each row has just that one link", async () => {
  setup([row("d", "draft"), row("r", "revision_requested"), row("a", "approved"), row("p", "pending"), row("x", "rejected")]);
  await screen.findByText("Trace d");
  const href = (name) => screen.getByRole("link", { name }).getAttribute("href");
  expect(href("Continue editing: Trace d")).toBe("/user/contributions/d/edit");
  expect(href("Revise: Trace r")).toBe("/user/contributions/r/edit");
  expect(href("View: Trace a")).toBe("/user/contributions/a");
  expect(href("View: Trace p")).toBe("/user/contributions/p");
  expect(href("View: Trace x")).toBe("/user/contributions/x");
  document.querySelectorAll(".contrib-row").forEach((rowElement) => expect(rowElement.querySelectorAll("a")).toHaveLength(1));
  expect(screen.queryByRole("link", { name: "Edit and resubmit" })).toBeNull();
});

it("moves Delete into a ⋯ menu that opens the existing confirmation", async () => {
  setup([row("d", "draft")]);
  expect(screen.queryByRole("button", { name: "Delete", exact: true })).toBeNull();
  const more = await screen.findByRole("button", { name: "More actions for Trace d" });
  expect(more.getAttribute("aria-expanded")).toBe("false");
  expect(more.closest("a")).toBeNull();
  fireEvent.click(more);
  expect(more.getAttribute("aria-expanded")).toBe("true");
  const item = screen.getByRole("menuitem", { name: "Delete" });
  fireEvent.click(item);
  expect(screen.getByRole("dialog", { name: "Delete this trace?" })).toBeTruthy();
  expect(screen.queryByRole("menu")).toBeNull();
});

it("closes the ⋯ menu with Escape and returns focus to its button", async () => {
  setup([row("d", "draft")]);
  const more = await screen.findByRole("button", { name: "More actions for Trace d" });
  fireEvent.click(more);
  fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
  expect(screen.queryByRole("menu")).toBeNull();
  expect(document.activeElement).toBe(more);
});

it("adds a count to each filter chip from the dashboard totals", async () => {
  setup([row("d", "draft")], "/user/contributions", { traces: 21, drafts: 7, pending: 4, approved: 6, needs_revision: 2, rejected: 2 });
  expect(await screen.findByRole("button", { name: "Draft 7" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "All 21" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Pending 4" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Approved 6" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Needs revision 2" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Rejected 2" })).toBeTruthy();
});

it("links New Trace instead of using a button", async () => {
  setup([row("d", "draft")]);
  await screen.findByText("Trace d");
  expect(screen.getByRole("link", { name: "New Trace" }).getAttribute("href")).toBe("/user/traces/upload");
  expect(screen.queryByRole("button", { name: "New Trace" })).toBeNull();
});

it("keeps the status filter and page in the URL", async () => {
  setup((request) => request.includes("status=draft") ? [row("d", "draft")] : Array.from({ length: 6 }, (_, i) => row(`all${i}`, "approved")));
  await screen.findByText("Trace all0");
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  expect(url()).toBe("/user/contributions?page=2");
  fireEvent.click(screen.getByRole("button", { name: "Draft" }));
  expect(url()).toBe("/user/contributions?status=draft");
  await screen.findByText("Trace d");
});

it("opens the bookmarked status and page", async () => {
  const fetch = setup([row("d", "draft")], "/user/contributions?status=draft&page=2");
  await waitFor(() => expect(fetch.mock.calls.some(([path]) => path === "/api/contributions?limit=6&offset=6&status=draft")).toBe(true));
});

it("returns to the same filter after opening a trace", async () => {
  // A pending trace opens the trace page (a draft would open the editor instead).
  setup([row("p", "pending")], "/user/contributions?status=pending");
  fireEvent.click(await screen.findByRole("link", { name: "View: Trace p" }));
  fireEvent.click(await screen.findByRole("link", { name: /Back to My Contributions/ }));
  await waitFor(() => expect(url()).toBe("/user/contributions?status=pending"));
});

it("invites a first upload when there is nothing yet", async () => {
  setup([]);
  expect(await screen.findByText("You haven't submitted any traces yet.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Upload your first trace" }).getAttribute("href")).toBe("/user/traces/upload");
});

it("explains an empty status and offers all traces", async () => {
  setup([], "/user/contributions?status=rejected");
  expect(await screen.findByText("No rejected traces.")).toBeTruthy();
  const link = screen.getByRole("link", { name: "Show all traces" });
  expect(link.getAttribute("href")).toBe("/user/contributions");
});
