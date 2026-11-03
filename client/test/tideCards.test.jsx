import React, { StrictMode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "./router.jsx";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";
import { readingMinutes, tideExcerpt, tideTone, TIDE_TONES } from "../src/api/tideText.js";

const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const summary = (extra = {}) => ({ id: "me", role: "user", as_of: "2026-11-03T01:00:00Z", member_since: "2026-08-10T00:00:00Z", traces: 5, drafts: 0, pending: 0, approved: 0, needs_revision: 0, comments_posted: 0, tides_finished: 3, ...extra });
const words = (count) => Array.from({ length: count }, (_, index) => `word${index}`).join(" ");
const lesson = (id, title, body) => ({ id, title, body, slug: title.toLowerCase(), status: "published", published_at: "2026-10-01T00:00:00Z" });

function setup({ lessons, completions = [], progress = [], finished = 3, published = 12 }) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "access", refresh_token: "refresh", expires_at: Date.now() / 1000 + 3600 }));
  vi.stubGlobal("fetch", vi.fn(async (url) => {
    if (url === "/api/auth/me") return ok({ id: "me", display_name: "Member", role: "user", status: "active" });
    if (url === "/api/dashboard") return ok(summary({ tides_finished: finished }));
    if (url === "/api/community-summary") return ok({ id: "community", published_tides: published, published_traces: 0, contributors: 0, tides_completed: 0, as_of: "2026-11-03T01:00:00Z" });
    if (url.startsWith("/api/tides?")) return ok(lessons);
    if (url.startsWith("/api/tide-completions")) return ok(completions);
    if (url.startsWith("/api/tide-progress")) return ok(progress);
    return ok([]);
  }));
  render(<StrictMode><MemoryRouter initialEntries={["/user/tides"]}><App /></MemoryRouter></StrictMode>);
}
beforeEach(() => { sessionStorage.clear(); });

it("makes a short preview that breaks on a word", () => {
  expect(tideExcerpt("Short text.")).toBe("Short text.");
  expect(tideExcerpt("  lots   of\n\nspace  ")).toBe("lots of space");
  const long = tideExcerpt(words(60), 40);
  expect(long.length).toBeLessThanOrEqual(41);
  expect(long.endsWith("…")).toBe(true);
  expect(long.slice(0, -1).split(" ").every((token) => /^word\d$/.test(token))).toBe(true);
  expect(tideExcerpt(undefined)).toBe("");
});

it("estimates reading time in whole minutes, at least one", () => {
  expect(readingMinutes("")).toBeNull();
  expect(readingMinutes(undefined)).toBeNull();
  expect(readingMinutes(words(10))).toBe(1);
  expect(readingMinutes(words(200))).toBe(1);
  expect(readingMinutes(words(201))).toBe(2);
  expect(readingMinutes(words(650))).toBe(4);
});

it("gives a lesson the same colour slot every time", () => {
  expect(tideTone("abc")).toBe(tideTone("abc"));
  for (const id of ["a", "b", "50000000-0000-4000-8000-000000000001", ""]) expect(tideTone(id)).toBeLessThan(TIDE_TONES);
});

it("shows a preview, reading time and overall progress, with one heading block", async () => {
  setup({ lessons: [lesson("l1", "Seagrass basics", words(450)), lesson("l2", "Reading the tide", "Short lesson.")], completions: [{ tide_id: "l1", completed_at: "2026-11-01T00:00:00Z" }] });
  const card = (await screen.findByRole("link", { name: /Seagrass basics/ }));
  expect(within(card).getByText("3 min read")).toBeTruthy();
  expect(await within(card).findByText("Completed")).toBeTruthy();
  expect(card.querySelector(".tide-excerpt").textContent).toMatch(/^word0 word1/);
  const other = screen.getByRole("link", { name: /Reading the tide/ });
  expect(within(other).getByText("1 min read")).toBeTruthy();
  expect(within(other).getByText("Not started")).toBeTruthy();
  const bar = await screen.findByRole("progressbar", { name: "Lessons completed" });
  expect(bar.getAttribute("aria-valuenow")).toBe("3");
  expect(bar.getAttribute("aria-valuemax")).toBe("12");
  expect(screen.getByText("3 of 12")).toBeTruthy();
  expect(screen.queryByText("Learn a new topic")).toBeNull();
});

it("never reports more finished lessons than there are published ones", async () => {
  setup({ lessons: [lesson("l1", "Seagrass basics", "Text.")], finished: 9, published: 4 });
  expect((await screen.findByRole("progressbar", { name: "Lessons completed" })).getAttribute("aria-valuenow")).toBe("4");
});

it("labels an unfinished chaptered lesson with the chapter reached, and filters by Incomplete", async () => {
  setup({ lessons: [lesson("l1", "Seagrass basics", "Text"), lesson("l2", "Reading the tide", "Text"), lesson("l3", "Mangrove roots", "Text")], completions: [{ tide_id: "l1", completed_at: "2026-11-01T00:00:00Z" }], progress: [{ tide_id: "l2", part: 3, total: 5 }, { tide_id: "l1", part: 4, total: 4 }] });
  expect(await within(await screen.findByRole("link", { name: /Reading the tide/ })).findByText("In progress, chapter 3 of 5")).toBeTruthy();
  expect(within(screen.getByRole("link", { name: /Seagrass basics/ })).getByText("Completed")).toBeTruthy();
  expect(within(screen.getByRole("link", { name: /Mangrove roots/ })).getByText("Not started")).toBeTruthy();
  const group = screen.getByRole("group", { name: "Filter by progress" });
  expect(within(group).getAllByRole("button").map((button) => button.textContent)).toEqual(["All lessons", "Incomplete", "Completed"]);
  fireEvent.click(within(group).getByRole("button", { name: "Incomplete" }));
  expect(within(group).getByRole("button", { name: "Incomplete" }).getAttribute("aria-pressed")).toBe("true");
  expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("progress=incomplete"))).toBe(true);
});
