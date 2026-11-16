import React, { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "./router.jsx";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";

beforeEach(() => {
  // jsdom does not implement the native modal's top layer or focus handling.
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value: function () { this.open = true; } },
    close: { configurable: true, value: function () { this.open = false; } },
  });
});
afterEach(() => vi.unstubAllEnvs());

const ledgerId = "40000000-0000-4000-8000-000000000001";
const flagId = "50000000-0000-4000-8000-000000000001";
const profile = { id: "current-admin", display_name: "Admin", email: "admin@example.test", status: "active", role: "admin" };
const response = (data, status = 200) => ({ ok: true, status, json: async () => ({ data }) });
const entry = (overrides = {}) => ({ id: ledgerId, owner_id: "m1", award_type: "trace_approval", source_id: "s1", amount: 20, reverses_id: null, reason: null,
  created_at: "2026-09-24T12:00:00Z", source_type: "trace", title: "Reef survey", source_deleted: false, reversed: false, owner_name: "Mia Member", open_flag: true, ...overrides });
const activity = () => ({ active: true, totals: { open_flags: 1, awards: 3, energy_issued: 45, reversals: 0 },
  open_flags: [{ id: flagId, ledger_id: ledgerId, reason: "Photo reused", created_at: "2026-09-25T12:00:00Z", title: "Reef survey", owner_name: "Mia Member", flagged_by_name: "Max Mod", amount: 20 }],
  awards: [entry()] });
const detail = (overrides = {}) => ({ ...entry(), reversal: null, flags: [{ id: flagId, status: "open", reason: "Photo reused", created_at: "2026-09-25T12:00:00Z", flagged_by_name: "Max Mod" }], audit: [], ...overrides });

function setup(handler, { flag = true } = {}) {
  if (flag) vi.stubEnv("VITE_ENERGY_ENABLED", "true");
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "live-access", refresh_token: "refresh", expires_at: Math.floor(Date.now() / 1000) + 3600 }));
  const calls = vi.fn(async (url, options) => {
    if (url === "/api/auth/me") return response(profile);
    return (await handler(url, options)) || response([]);
  });
  vi.stubGlobal("fetch", calls);
  return calls;
}
const open = (path) => render(<StrictMode><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></StrictMode>);

it("lists totals, open flags and awards, and links to the case", async () => {
  setup((url) => url.startsWith("/api/admin/energy/activity") ? response(activity()) : undefined);
  open("/admin/energy");
  expect(await screen.findByRole("heading", { name: "Energy activity" })).toBeTruthy();
  expect(await screen.findByRole("link", { name: "Review flag: Reef survey" })).toBeTruthy();
  const link = screen.getByRole("link", { name: "Open award: Reef survey for Mia Member" });
  expect(link.getAttribute("href")).toBe(`/admin/energy/awards/${ledgerId}`);
  expect(screen.getByText("Energy issued")).toBeTruthy();
});

it("filters awards by source type", async () => {
  const calls = setup((url) => url.startsWith("/api/admin/energy/activity") ? response(activity()) : undefined);
  open("/admin/energy");
  fireEvent.click(await screen.findByRole("button", { name: "Quizzes" }));
  await waitFor(() => expect(calls.mock.calls.some(([url]) => url.includes("kind=quiz"))).toBe(true));
});

it("does not offer the page when energy is off", async () => {
  setup(() => undefined, { flag: false });
  open("/admin/energy");
  await waitFor(() => expect(screen.queryByRole("heading", { name: "Energy activity" })).toBeNull());
});

it("dismisses a flag with a reason and shows the outcome inline", async () => {
  const calls = setup((url, options) => {
    if (url === `/api/admin/energy/awards/${ledgerId}`) return response(detail());
    if (url === `/api/admin/energy/flags/${flagId}/dismiss`) return response({ ok: true });
  });
  open(`/admin/energy/awards/${ledgerId}`);
  expect(await screen.findByRole("heading", { name: "Flag on a Trace award" })).toBeTruthy();
  const save = screen.getByRole("button", { name: "Save decision" });
  expect(save.disabled).toBe(true);
  fireEvent.click(screen.getByLabelText("Dismiss flag. The award stays."));
  fireEvent.change(screen.getByLabelText("Reason (required)"), { target: { value: "Evidence checks out" } });
  fireEvent.click(save);
  expect(await screen.findByText("Decision saved: flag dismissed.")).toBeTruthy();
  const post = calls.mock.calls.find(([url]) => url.endsWith("/dismiss"));
  expect(JSON.parse(post[1].body)).toEqual({ reason: "Evidence checks out" });
});

it("asks for confirmation before reversing an award", async () => {
  const calls = setup((url) => {
    if (url === `/api/admin/energy/awards/${ledgerId}`) return response(detail());
    if (url === `/api/admin/energy/awards/${ledgerId}/reverse`) return response({ ok: true });
  });
  open(`/admin/energy/awards/${ledgerId}`);
  fireEvent.click(await screen.findByLabelText("Reverse award. Adds a compensating entry."));
  fireEvent.change(screen.getByLabelText("Reason (required)"), { target: { value: "Reused photo" } });
  fireEvent.click(screen.getByRole("button", { name: "Save decision" }));
  const dialog = await screen.findByRole("dialog", { hidden: true });
  expect(within(dialog).getByText("Reverse 20 Tide Energy?")).toBeTruthy();
  expect(calls.mock.calls.some(([url]) => url.endsWith("/reverse"))).toBe(false);
  fireEvent.click(within(dialog).getByRole("button", { name: "Reverse award", hidden: true }));
  expect(await screen.findByText("Decision saved: award reversed.")).toBeTruthy();
});

it("locks a reversed award and notes a deleted source", async () => {
  setup((url) => url.startsWith("/api/admin/energy/awards/") ? response(detail({ reversed: true, source_deleted: true, flags: [] })) : undefined);
  open(`/admin/energy/awards/${ledgerId}`);
  expect(await screen.findByText("A reversed award cannot be reversed again or earned again for this source.")).toBeTruthy();
  expect(screen.getByText(/was deleted by its author/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Save decision" })).toBeNull();
});
