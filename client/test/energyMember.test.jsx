import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "./router.jsx";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";

const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const fail = (status = 500) => ({ ok: false, status, json: async () => ({ error: { code: "SERVER_ERROR", message: "Something went wrong." } }) });
const totals = { id: "me", role: "user", as_of: "2026-11-03T01:00:00Z", member_since: "2026-08-10T00:00:00Z", traces: 5, active_traces: 5, drafts: 0, pending: 1, approved: 2, needs_revision: 0, comments_posted: 0, tides_finished: 0 };
const entry = (id, extra = {}) => ({ id, owner_id: "me", award_type: "trace_approval", source_id: `s${id}`, amount: 20, reverses_id: null, reason: null, created_at: "2026-11-05T12:00:00Z", source_type: "trace_approval", title: `Source ${id}`, source_deleted: false, reversed: false, ...extra });
const page = (items, extra = {}) => ({ balance: 40, active: true, items, ...extra });
const readyCard = { state: "ready", tide_id: "t1", title: "Understanding Tides", active: true, earned: 0 };

beforeEach(() => {
  sessionStorage.clear();
  vi.stubEnv("VITE_ENERGY_ENABLED", "true");
});
afterEach(() => vi.unstubAllEnvs());

// `energy` answers every ledger read; `ready` answers the dashboard card. Each is a function of the request URL.
function setup({ path = "/user/energy", energy = () => ok(page([])), ready = () => ok({ state: "none" }), notes = () => [] } = {}) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "access", refresh_token: "refresh", expires_at: Date.now() / 1000 + 3600 }));
  const fetch = vi.fn(async (url) => {
    if (url === "/api/auth/me") return ok({ id: "me", display_name: "Member", role: "user", status: "active", data_saver: true });
    if (url === "/api/dashboard") return ok(totals);
    if (url === "/api/energy/quiz-ready") return ready(url);
    if (url.startsWith("/api/energy?")) return energy(url);
    if (url === "/api/notifications/unread-count") return ok({ count: notes().filter((row) => !row.read_at).length });
    if (url.startsWith("/api/notifications?")) return ok(notes());
    return ok([]);
  });
  vi.stubGlobal("fetch", fetch);
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
  return fetch;
}
const energyCalls = (fetch) => fetch.mock.calls.map(([url]) => url).filter((url) => url.startsWith("/api/energy"));

it("shows nothing and asks for nothing while the flag is off", async () => {
  vi.stubEnv("VITE_ENERGY_ENABLED", "");
  const fetch = setup({ path: "/user/dashboard" });
  await screen.findByRole("heading", { name: /Kumusta/ });
  expect(screen.queryByRole("link", { name: /Tide Energy balance/ })).toBeNull();
  expect(screen.queryByRole("link", { name: "Energy" })).toBeNull();
  expect(energyCalls(fetch)).toHaveLength(0);
});

it("sends a switched-off energy page to the home page", async () => {
  vi.stubEnv("VITE_ENERGY_ENABLED", "");
  const fetch = setup();
  await waitFor(() => expect(screen.queryByRole("heading", { name: "Your energy" })).toBeNull());
  expect(energyCalls(fetch)).toHaveLength(0);
});

it("puts the balance pill and an Energy link in the member navigation", async () => {
  setup({ path: "/user/dashboard", energy: () => ok(page([], { balance: 45 })) });
  const pill = await screen.findByRole("link", { name: "Tide Energy balance: 45" });
  expect(pill.getAttribute("href")).toBe("/user/energy");
  expect(screen.getByRole("link", { name: "Energy" }).getAttribute("href")).toBe("/user/energy");
});

it("hides the pill when the balance cannot be read", async () => {
  setup({ path: "/user/dashboard", energy: () => fail() });
  await screen.findByRole("heading", { name: /Kumusta/ });
  expect(screen.queryByRole("link", { name: /Tide Energy balance/ })).toBeNull();
});

it("shows the dashboard energy card with the balance and a link to the history", async () => {
  setup({ path: "/user/dashboard", energy: () => ok(page([], { balance: 45 })) });
  const card = await screen.findByRole("region", { name: "Tide Energy" });
  expect(within(card).getByText("45")).toBeTruthy();
  expect(within(card).getByRole("link", { name: "View energy history →" }).getAttribute("href")).toBe("/user/energy");
});

it("replaces Continue learning with the quiz-ready card", async () => {
  setup({ path: "/user/dashboard", ready: () => ok(readyCard) });
  const card = await screen.findByRole("region", { name: "Understanding Tides" });
  expect(within(card).getByText("Quiz ready")).toBeTruthy();
  expect(within(card).getByText("Pass the quiz to earn 15 more Tide Energy.")).toBeTruthy();
  expect(within(card).getByRole("link", { name: "Go to quiz →" }).getAttribute("href")).toBe("/user/tides/t1");
  expect(screen.queryByRole("region", { name: "Continue learning" })).toBeNull();
});

it("does not promise energy in the quiz-ready card while awards are paused", async () => {
  setup({ path: "/user/dashboard", ready: () => ok({ ...readyCard, active: false }) });
  expect(await screen.findByText("Take the quiz for this lesson.")).toBeTruthy();
  expect(screen.queryByText(/15 more Tide Energy/)).toBeNull();
});

it("shows the finished-lesson card after a pass, with what was earned", async () => {
  setup({ path: "/user/dashboard", ready: () => ok({ ...readyCard, state: "done", earned: 20 }) });
  expect(await screen.findByRole("heading", { name: "Understanding Tides is done" })).toBeTruthy();
  expect(screen.getByText("You earned 20 Tide Energy from this lesson and its quiz.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Browse Tides" }).getAttribute("href")).toBe("/user/tides");
  expect(screen.queryByRole("region", { name: "Continue learning" })).toBeNull();
});

it("keeps Continue learning when no quiz is waiting", async () => {
  setup({ path: "/user/dashboard" });
  expect(await screen.findByRole("region", { name: "Continue learning" })).toBeTruthy();
  expect(screen.queryByText("Quiz ready")).toBeNull();
});

it("shows the balance, how energy is earned and disabled reward previews", async () => {
  setup({ energy: () => ok(page([entry("1")], { balance: 40 })) });
  const balance = await screen.findByRole("region", { name: "Balance" });
  expect(await within(balance).findByText("40")).toBeTruthy();
  expect(within(balance).getByText("Personal and not transferable.")).toBeTruthy();
  const earn = within(balance).getByRole("group", { name: "How you earn" });
  expect(within(earn).getByText("+20")).toBeTruthy();
  expect(within(earn).getByText("+5")).toBeTruthy();
  expect(within(earn).getByText("+15")).toBeTruthy();
  const redeem = within(screen.getByRole("region", { name: "Reward previews" })).getAllByRole("button", { name: "Redeem" });
  expect(redeem).toHaveLength(4);
  redeem.forEach((button) => expect(button.disabled).toBe(true));
});

it("lists the history with labels, signs, dates and the reversal reason", async () => {
  const items = [
    entry("1", { amount: -20, reverses_id: "2", reason: "The photo did not match the location.", award_type: "reversal", title: "Trash found at Esplanade!" }),
    entry("2", { reversed: true, title: "Trash found at Esplanade!" }),
    entry("3", { award_type: "quiz_pass", amount: 15, title: "Reading the Shoreline" }),
    entry("4", { award_type: "tide_completion", amount: 5, title: "Reading the Shoreline" }),
  ];
  setup({ energy: () => ok(page(items, { balance: 15 })) });
  const history = await screen.findByRole("region", { name: "History" });
  const rows = await within(history).findAllByRole("listitem");
  expect(rows).toHaveLength(4);
  expect(within(rows[0]).getByText("Reversal")).toBeTruthy();
  expect(within(rows[0]).getByText("−20")).toBeTruthy();
  expect(within(rows[0]).getByText("Reversed by an admin. The photo did not match the location.")).toBeTruthy();
  expect(within(rows[1]).getByText("Reversed")).toBeTruthy();
  expect(within(rows[1]).getByText("+20")).toBeTruthy();
  expect(within(rows[2]).getByText("Quiz passed")).toBeTruthy();
  expect(within(rows[2]).getByText("5 Nov 2026")).toBeTruthy();
  expect(within(rows[3]).getByText("Tide completed")).toBeTruthy();
});

it("filters the history on the server and goes back to the first page", async () => {
  const fetch = setup({ energy: (url) => ok(page(url.includes("kind=quiz") ? [] : [entry("1")])) });
  await screen.findByText("Source 1");
  fireEvent.click(screen.getByRole("button", { name: "Quizzes" }));
  expect(await screen.findByText("Nothing in this filter yet.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Quizzes" }).getAttribute("aria-pressed")).toBe("true");
  expect(energyCalls(fetch).some((url) => url === "/api/energy?limit=6&offset=0&kind=quiz")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "All" }));
  expect(await screen.findByText("Source 1")).toBeTruthy();
});

it("pages through a long history", async () => {
  const full = Array.from({ length: 6 }, (_, i) => entry(String(i + 1)));
  const fetch = setup({ energy: (url) => ok(page(url.includes("offset=6") ? [entry("9")] : full)) });
  await screen.findByText("Source 1");
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  expect(await screen.findByText("Source 9")).toBeTruthy();
  expect(energyCalls(fetch)).toContain("/api/energy?limit=6&offset=6");
});

it("shows an empty state that points to the lessons", async () => {
  setup({ energy: () => ok(page([], { balance: 0 })) });
  expect(await screen.findByText("No Tide Energy yet.")).toBeTruthy();
  expect(screen.getByText("Finish a lesson, pass a quiz or have a Trace approved to start earning.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Browse Tides" }).getAttribute("href")).toBe("/user/tides");
  const balance = screen.getByRole("region", { name: "Balance" });
  expect(within(balance).getByText("0", { exact: true })).toBeTruthy();
});

it("keeps the page usable when the history fails, and can try again", async () => {
  let calls = 0;
  setup({ energy: () => (++calls <= 2 ? fail() : ok(page([entry("1")]))) });
  expect(await screen.findByText("Could not load your energy history.")).toBeTruthy();
  const balance = screen.getByRole("region", { name: "Balance" });
  expect(within(balance).getByText("Not available")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("Source 1")).toBeTruthy();
});

it("rereads the pill balance when a lesson or quiz earns energy", async () => {
  let balance = 40;
  setup({ path: "/user/dashboard", energy: () => ok(page([], { balance })) });
  expect(await screen.findByRole("link", { name: "Tide Energy balance: 40" })).toBeTruthy();
  balance = 45;
  window.dispatchEvent(new Event("tidetrace:energy-changed"));
  expect(await screen.findByRole("link", { name: "Tide Energy balance: 45" })).toBeTruthy();
});

const note = (id, type, message) => ({ id, type, message, read_at: null, created_at: "2026-11-11T02:00:00Z" });

it("toasts and refreshes the balance when a Trace is approved while signed in, but not for notices already there", async () => {
  let balance = 40;
  let list = [note("n1", "trace_review", 'Your Trace "Old": approved. You earned 20 Tide Energy.')];
  setup({ path: "/user/dashboard", energy: () => ok(page([], { balance })), notes: () => list });
  expect(await screen.findByRole("link", { name: "Tide Energy balance: 40" })).toBeTruthy();
  expect(screen.queryByText("You earned 20 Tide Energy for a Trace.")).toBeNull();
  balance = 60;
  list = [note("n2", "trace_review", 'Your Trace "New": approved. You earned 20 Tide Energy.'), ...list];
  window.dispatchEvent(new Event("focus"));
  expect(await screen.findByText("You earned 20 Tide Energy for a Trace.")).toBeTruthy();
  expect(await screen.findByRole("link", { name: "Tide Energy balance: 60" })).toBeTruthy();
});

it("says so when an admin reverses energy, and ignores notices that earned nothing", async () => {
  let list = [];
  setup({ path: "/user/dashboard", notes: () => list });
  await screen.findByRole("link", { name: /Tide Energy balance/ });
  list = [note("n3", "trace_review", 'Your Trace "Rejected": rejected. Not clear.'), note("n4", "energy_reversal", 'An admin reversed 20 Tide Energy for your Trace "X". Reason: no.')];
  window.dispatchEvent(new Event("focus"));
  expect(await screen.findByText("An admin reversed 20 Tide Energy.")).toBeTruthy();
  expect(screen.queryByText(/You earned/)).toBeNull();
});
