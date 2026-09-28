import React, { StrictMode } from "react";
import { it, expect, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";
const as_of = "2026-09-28T10:00:00Z";
const summary = (role = "user", extra = {}) => ({ id: "member-id", role, as_of, member_since: "2026-08-10T00:00:00Z", traces: 52, drafts: 27, pending: 12, approved: 10, needs_revision: 3, comments_posted: 44, tides_finished: 8, flagged_comments: 9, open_reports: 39, reviewed_today: 7, users: 201, active_users: 199, moderators: 4, published_traces: 105, published_tides: 31, ...extra });
const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
function setup(role = "user", handler = () => undefined) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "live-access", refresh_token: "refresh", expires_at: Date.now() / 1000 + 3600 }));
  const fetch = vi.fn(async (url, options) => {
    const custom = await handler(url, options);
    if (custom) return custom;
    if (url === "/api/auth/me") return ok({ id: "member-id", display_name: "Member", role, status: "active" });
    if (url === "/api/dashboard") return ok(summary(role));
    return ok([]);
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
const open = (path) => render(<StrictMode><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></StrictMode>);
it.each([["user", "user", "Your Traces", "52"], ["moderator", "moderator", "Open reports", "39"], ["admin", "admin", "Registered accounts", "201"]])("shows database totals for %s rather than paginated list lengths", async (role, prefix, label, count) => {
  setup(role); open(`/${prefix}/dashboard`);
  const region = await screen.findByRole("region", { name: "Dashboard totals" });
  await waitFor(() => expect(within(region).getByText(label).closest(".stat").textContent).toContain(count));
});
it("uses saved usage totals and join date, replacing learning minutes", async () => {
  const calls = setup(); open("/user/profile");
  fireEvent.click(await screen.findByRole("button", { name: "Usage & activity" }));
  const region = await screen.findByRole("region", { name: "Usage totals" });
  await waitFor(() => expect(within(region).getByText("Tides finished").closest(".setrow").textContent).toContain("8"));
  expect(within(region).getByText("Comments posted").closest(".setrow").textContent).toContain("44");
  expect(screen.getByText("Member since").closest(".setrow").textContent).toMatch(/August.*2026/);
  expect(screen.queryByText("Learning minutes")).toBeNull();
  expect(calls.mock.calls.some(([url]) => url === "/api/dashboard")).toBe(true);
});
it("shows skeletons, preserves real zero, and rejects another account's response", async () => {
  let finish;
  let data = summary("user", { traces: 0 });
  const pending = new Promise((resolve) => { finish = resolve; });
  let first = true;
  setup("user", (url) => url === "/api/dashboard" ? first ? pending : ok(data) : undefined);
  open("/user/dashboard");
  await screen.findByLabelText("Loading Your Traces");
  await act(async () => finish(ok(data)));
  const region = screen.getByRole("region", { name: "Dashboard totals" });
  await waitFor(() => expect(within(region).getByText("Your Traces").closest(".stat").querySelector("b").textContent).toBe("0"));
  first = false; data = { ...data, id: "other-account" };
  fireEvent.click(within(region).getByRole("button", { name: "Refresh totals" }));
  await within(region).findByRole("alert");
  expect(within(region).getByText("Your Traces").closest(".stat").querySelector("b").textContent).toBe("—");
});
it("refreshes on focus and every 30 seconds, pauses when hidden and stops on logout", async () => {
  let approved = 10;
  const calls = setup("user", (url) => url === "/api/dashboard" ? ok(summary("user", { approved })) : undefined);
  const view = open("/user/dashboard");
  const region = await screen.findByRole("region", { name: "Dashboard totals" });
  await within(region).findByText("10");
  approved = 11;
  fireEvent(window, new Event("focus"));
  await within(region).findByText("11");
  view.unmount();
  vi.useFakeTimers();
  // Remount the page so its polling timer is controlled by fake timers.
  await act(async () => { open("/user/profile"); });
  fireEvent.click(screen.getByRole("button", { name: "Usage & activity" }));
  await act(async () => {});
  let count = calls.mock.calls.filter(([url]) => url === "/api/dashboard").length;
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(calls.mock.calls.filter(([url]) => url === "/api/dashboard").length).toBe(count + 1);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  count++;
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(calls.mock.calls.filter(([url]) => url === "/api/dashboard").length).toBe(count);
  fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(calls.mock.calls.filter(([url]) => url === "/api/dashboard").length).toBe(count);
});
it("offers retry on failure and ignores pending totals after logout", async () => {
  let finish;
  let fails = true;
  setup("user", (url) => url === "/api/dashboard" ? fails ? { ok: false, status: 503, json: async () => ({ error: { message: "Totals unavailable" } }) } : new Promise((resolve) => { finish = resolve; }) : undefined);
  open("/user/dashboard");
  const region = await screen.findByRole("region", { name: "Dashboard totals" });
  await within(region).findByText("Totals unavailable");
  fails = false;
  fireEvent.click(within(region).getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(finish).toBeTypeOf("function"));
  fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  await act(async () => finish(ok(summary())));
  expect(screen.queryByRole("region", { name: "Dashboard totals" })).toBeNull();
});
