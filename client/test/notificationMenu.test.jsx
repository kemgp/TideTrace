import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "./router.jsx";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";

const response = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const make = (id, message, read = false) => ({ id, message, created_at: new Date(Date.now() - 3600000).toISOString(), read_at: read ? "2026-11-01T00:00:00Z" : null });

function setup({ rows = [make("n1", "Your Trace was approved."), make("n2", "A comment needs a reply.", true)], fail = false } = {}) {
  let list = rows;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "access", refresh_token: "refresh", expires_at: Date.now() / 1000 + 3600 }));
  const calls = vi.fn(async (url, options = {}) => {
    if (url === "/api/auth/me") return response({ id: "me", role: "user", status: "active", display_name: "Member" });
    if (url === "/api/notifications/unread-count") return response({ count: list.filter((row) => !row.read_at).length });
    if (url === "/api/notifications/read") {
      const { ids } = JSON.parse(options.body);
      list = list.map((row) => ids === null || ids.includes(row.id) ? { ...row, read_at: "2026-11-03T00:00:00Z" } : row);
      return { ok: true, status: 204 };
    }
    if (url.startsWith("/api/notifications?")) return fail ? { ok: false, status: 503, json: async () => ({ error: { message: "Unavailable." } }) } : response(list);
    return response([]);
  });
  vi.stubGlobal("fetch", calls);
  render(<MemoryRouter initialEntries={["/user/tides"]}><App /></MemoryRouter>);
  return calls;
}
beforeEach(() => { sessionStorage.clear(); });
const bell = () => screen.findByRole("button", { name: /^Notifications/ });
const listFetches = (calls) => calls.mock.calls.filter(([url]) => String(url).startsWith("/api/notifications?limit=10")).length;

it("shows the unread count on the bell and loads the list only when it is opened", async () => {
  const calls = setup();
  const button = await bell();
  await waitFor(() => expect(button.getAttribute("aria-label")).toBe("Notifications (1 unread)"));
  expect(listFetches(calls)).toBe(0);
  fireEvent.click(button);
  const panel = await screen.findByRole("region", { name: "Notifications panel" });
  expect(await within(panel).findByText("Your Trace was approved.")).toBeTruthy();
  expect(within(panel).getByText("A comment needs a reply.")).toBeTruthy();
  expect(button.getAttribute("aria-expanded")).toBe("true");
  expect(within(panel).getByRole("link", { name: "See all notifications" }).getAttribute("href")).toBe("/user/notifications");
});

it("filters to unread notifications", async () => {
  setup();
  fireEvent.click(await bell());
  const panel = await screen.findByRole("region", { name: "Notifications panel" });
  await within(panel).findByText("A comment needs a reply.");
  fireEvent.click(within(panel).getByRole("button", { name: "Unread" }));
  expect(within(panel).queryByText("A comment needs a reply.")).toBeNull();
  expect(within(panel).getByText("Your Trace was approved.")).toBeTruthy();
});

it("marks everything read from the panel and updates the badge", async () => {
  const calls = setup();
  const button = await bell();
  await waitFor(() => expect(button.getAttribute("aria-label")).toBe("Notifications (1 unread)"));
  fireEvent.click(button);
  const panel = await screen.findByRole("region", { name: "Notifications panel" });
  fireEvent.click(await within(panel).findByRole("button", { name: "Mark all as read" }));
  await waitFor(() => expect(button.getAttribute("aria-label")).toBe("Notifications"));
  expect(JSON.parse(calls.mock.calls.find(([url]) => url === "/api/notifications/read")[1].body)).toEqual({ ids: null });
  expect(within(panel).queryByRole("button", { name: "Mark all as read" })).toBeNull();
});

it("opens the notifications page and marks a notification read when it is chosen", async () => {
  const calls = setup();
  fireEvent.click(await bell());
  fireEvent.click(await screen.findByRole("button", { name: /Your Trace was approved/ }));
  await screen.findByRole("heading", { name: "Stay updated" });
  expect(screen.queryByRole("region", { name: "Notifications panel" })).toBeNull();
  await waitFor(() => expect(JSON.parse(calls.mock.calls.find(([url]) => url === "/api/notifications/read")[1].body)).toEqual({ ids: ["n1"] }));
});

it("closes with Escape and returns focus to the bell, and closes on an outside click", async () => {
  setup();
  const button = await bell();
  fireEvent.click(button);
  await screen.findByRole("region", { name: "Notifications panel" });
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("region", { name: "Notifications panel" })).toBeNull();
  expect(document.activeElement).toBe(button);
  fireEvent.click(button);
  await screen.findByRole("region", { name: "Notifications panel" });
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole("region", { name: "Notifications panel" })).toBeNull();
});

it("shows an empty state and an error with retry", async () => {
  setup({ rows: [] });
  fireEvent.click(await bell());
  expect(await screen.findByText("You're all caught up.")).toBeTruthy();
});

it("reports a failed load and offers to try again", async () => {
  setup({ fail: true });
  fireEvent.click(await bell());
  const panel = await screen.findByRole("region", { name: "Notifications panel" });
  expect(await within(panel).findByRole("alert")).toBeTruthy();
  expect(within(panel).getByRole("button", { name: "Try again" })).toBeTruthy();
});
