import React, { StrictMode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "./router.jsx";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";
import { attentionLine, nextLesson } from "../src/api/dashboardText.js";

const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const summary = (extra = {}) => ({ id: "me", role: "user", as_of: "2026-11-03T01:00:00Z", member_since: "2026-08-10T00:00:00Z", traces: 5, drafts: 0, pending: 1, approved: 2, needs_revision: 0, comments_posted: 0, tides_finished: 0, ...extra });
const row = (id, status, extra = {}) => ({ id, title: `Trace ${id}`, author_id: "me", status, category: { id: "c", name: "Pollution" }, location_name: "Coast", description: "x",
  created_at: "2026-10-20T00:00:00Z", updated_at: "2026-10-24T00:00:00Z", trace_media: [], version: 1, ...extra });
const note = (id, message, read_at = null) => ({ id, message, type: "trace_approved", read_at, created_at: "2026-11-02T10:00:00Z" });
const lesson = (id) => ({ id, title: `Lesson ${id}`, status: "published" });

function setup({ totals = summary(), revisions = [], drafts = [], lessons = [], completions = [], notifications = [], progress = [] } = {}) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "access", refresh_token: "refresh", expires_at: Date.now() / 1000 + 3600 }));
  const fetch = vi.fn(async (url) => {
    if (url === "/api/auth/me") return ok({ id: "me", display_name: "Member", role: "user", status: "active", data_saver: true });
    if (url === "/api/dashboard") return ok(totals);
    if (url.startsWith("/api/contributions?") && url.includes("status=revision_requested")) return ok(revisions);
    if (url.startsWith("/api/contributions?") && url.includes("status=draft")) return ok(drafts);
    if (url === "/api/notifications/unread-count") return ok({ count: notifications.filter((row) => !row.read_at).length });
    if (url.startsWith("/api/notifications?")) return ok(notifications);
    if (url.startsWith("/api/tides?")) return ok(lessons);
    if (url.startsWith("/api/tide-completions")) return ok(completions);
    if (url.startsWith("/api/tide-progress")) return ok(progress);
    return ok([]);
  });
  vi.stubGlobal("fetch", fetch);
  render(<StrictMode><MemoryRouter initialEntries={["/user/dashboard"]}><App /></MemoryRouter></StrictMode>);
  return fetch;
}
beforeEach(() => { sessionStorage.clear(); });

it("writes one useful sentence from the counts", () => {
  expect(attentionLine(null)).toBe("Your traces and lessons at a glance.");
  expect(attentionLine(summary({ drafts: 2, needs_revision: 1 }))).toBe("1 revision request and 2 drafts need your attention.");
  expect(attentionLine(summary({ drafts: 1 }))).toBe("1 draft needs your attention.");
  expect(attentionLine(summary({ needs_revision: 3 }))).toBe("3 revision requests need your attention.");
  expect(attentionLine(summary())).toBe("You're all caught up.");
  expect(attentionLine(summary({ traces: 0 }))).toBe("Share your first trace.");
});

it("picks the first lesson that is not finished", () => {
  expect(nextLesson([lesson("a"), lesson("b"), lesson("c")], [{ tide_id: "a" }]).id).toBe("b");
  expect(nextLesson([lesson("a")], [{ tide_id: "a" }])).toBeNull();
  expect(nextLesson([], [])).toBeNull();
});

it("shows the attention sentence and lists revisions before drafts", async () => {
  setup({ totals: summary({ drafts: 1, needs_revision: 1 }), revisions: [row("r", "revision_requested", { note: "Add a clearer photo" })], drafts: [row("d", "draft")] });
  expect(await screen.findByText("1 revision request and 1 draft need your attention.")).toBeTruthy();
  const section = await screen.findByRole("region", { name: "Needs your attention" });
  const links = within(section).getAllByRole("link");
  expect(links.map((link) => link.getAttribute("href"))).toEqual(["/user/contributions/r", "/user/contributions/d/edit"]);
  expect(within(section).getByText("Reviewer: Add a clearer photo")).toBeTruthy();
  expect(within(section).getByText("Not submitted yet")).toBeTruthy();
});

it("hides the attention list when nothing needs action", async () => {
  setup();
  expect(await screen.findByText("You're all caught up.")).toBeTruthy();
  expect(screen.queryByText("Needs your attention")).toBeNull();
});

it("offers a link to everything when more than three need action", async () => {
  setup({ totals: summary({ drafts: 5 }), drafts: [row("1", "draft"), row("2", "draft"), row("3", "draft")] });
  const more = await screen.findByRole("link", { name: "See all 5" });
  expect(more.getAttribute("href")).toBe("/user/contributions");
});

it("opens My Contributions from each stat tile", async () => {
  setup();
  const region = await screen.findByRole("region", { name: "Dashboard totals" });
  const href = (label) => within(region).getByText(label).closest("a").getAttribute("href");
  expect(href("Your Traces")).toBe("/user/contributions");
  expect(href("Approved")).toBe("/user/contributions?status=approved");
  expect(href("In review")).toBe("/user/contributions?status=pending");
});

it("continues with the next unfinished lesson", async () => {
  setup({ lessons: [lesson("a"), lesson("b")], completions: [{ tide_id: "a", completed_at: "2026-11-01T00:00:00Z" }] });
  expect(await screen.findByText("Lesson b")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Open lesson →" }).getAttribute("href")).toBe("/user/tides/b");
});

it("says so when every lesson is finished, and falls back when there are none", async () => {
  setup({ lessons: [lesson("a")], completions: [{ tide_id: "a" }] });
  expect(await screen.findByText("You have finished the latest lessons.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Browse lessons →" }).getAttribute("href")).toBe("/user/tides");
});

it("falls back to browsing when there are no lessons", async () => {
  setup();
  await waitFor(() => expect(screen.getByRole("link", { name: "Browse lessons →" }).getAttribute("href")).toBe("/user/tides"));
  expect(screen.getByText("Coastal lessons from your community.")).toBeTruthy();
});

it("puts the greeting in the page heading with a single upload action", async () => {
  setup();
  const heading = await screen.findByRole("heading", { level: 1, name: /Kumusta, Member/ });
  expect(heading).toBeTruthy();
  const upload = screen.getByRole("link", { name: "Upload trace" });
  expect(upload.getAttribute("href")).toBe("/user/traces/upload");
  expect(screen.queryByRole("button", { name: "Refresh totals" })).toBeNull();
  expect(screen.queryByText("Go to")).toBeNull();
  expect(screen.getByRole("link", { name: "See all traces" }).getAttribute("href")).toBe("/user/traces");
});

it("shows the latest unread notifications and links to all of them", async () => {
  setup({ notifications: [note("n1", "Your trace Pin persistence test was approved."), note("n2", "A reviewer left feedback on Test."), note("n3", "Old news", "2026-11-02T11:00:00Z")] });
  await screen.findByText("Your trace Pin persistence test was approved.");
  const section = screen.getByRole("region", { name: "What's new" });
  expect(within(section).getByText("A reviewer left feedback on Test.")).toBeTruthy();
  expect(within(section).queryByText("Old news")).toBeNull();
  expect(within(section).getByRole("link", { name: "All notifications" })).toBeTruthy();
  within(section).getAllByRole("link").forEach((link) => expect(link.getAttribute("href")).toBe("/user/notifications"));
});

it("shows nothing for notifications when everything is read", async () => {
  setup({ notifications: [note("n3", "Old news", "2026-11-02T11:00:00Z")] });
  await screen.findByText("You're all caught up.");
  expect(screen.queryByText("What's new")).toBeNull();
});

it("shows the chapter reached on the continue card, and offers to continue", async () => {
  setup({ lessons: [lesson("a"), lesson("b")], completions: [{ tide_id: "a", completed_at: "2026-11-01T00:00:00Z" }], progress: [{ tide_id: "b", part: 3, total: 5 }] });
  expect(await screen.findByText("Chapter 3 of 5")).toBeTruthy();
  const bar = screen.getByRole("progressbar", { name: "Lesson progress" });
  expect(bar.getAttribute("aria-valuenow")).toBe("3");
  expect(bar.getAttribute("aria-valuemax")).toBe("5");
  expect(screen.getByRole("link", { name: "Continue lesson →" }).getAttribute("href")).toBe("/user/tides/b");
});

it("puts the totals under the page header and does not repeat an activity heading", async () => {
  setup();
  const region = await screen.findByRole("region", { name: "Dashboard totals" });
  expect(region.closest(".page-body")).toBeTruthy();
  expect(document.querySelector(".page-hero")).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Your activity" })).toBeNull();
});
