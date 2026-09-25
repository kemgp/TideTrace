import React from "react";
import { expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";
import useNotifications from "../src/hooks/useNotifications.js";

const row = { id: "10000000-0000-4000-8000-000000000001", message: "Your Trace needs clearer evidence.", created_at: "2026-09-25T12:00:00Z", read_at: null };
const response = data => ({ ok: true, status: 200, json: async () => ({ data }) });
function setup({ failRead = false, failWrite = false, many = false } = {}) {
  let rows = many ? Array.from({ length: 26 }, (_, i) => ({ ...row, id: `${i}`, message: `Update ${i}` })) : [{ ...row }];
  let failing = failRead;
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "access", refresh_token: "refresh", expires_at: Math.floor(Date.now() / 1000) + 3600 }));
  const fetchMock = vi.fn(async (url, options) => {
    if (url === "/api/auth/me") return response({ id: "member", role: "user", status: "active", display_name: "Member" });
    if (url === "/api/notifications/read") {
      if (failWrite) throw new Error("offline");
      const { ids } = JSON.parse(options.body);
      rows = rows.map(n => ids === null || ids.includes(n.id) ? { ...n, read_at: "2026-09-25T13:00:00Z" } : n);
      return { ok: true, status: 204 };
    }
    if (url === "/api/notifications/unread-count") return response({ count: rows.filter(n => !n.read_at).length });
    if (url.startsWith("/api/notifications?")) {
      if (failing) throw new Error("offline");
      const offset = Number(new URL(url, "http://localhost").searchParams.get("offset"));
      return response(rows.slice(offset, offset + 25));
    }
    return response([]);
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<MemoryRouter initialEntries={["/user/notifications"]}><App /></MemoryRouter>);
  return { fetchMock, recover: () => { failing = false; } };
}

it("loads saved notifications and persists individual read status with an updated badge", async () => {
  const { fetchMock } = setup();
  const item = (await screen.findByText(row.message)).closest(".nitem");
  expect(item.classList.contains("is-unread")).toBe(true);
  const readsBefore = fetchMock.mock.calls.filter(([url]) => url.startsWith("/api/notifications") && url !== "/api/notifications/read").length;
  expect(screen.getByRole("link", { name: "Notifications (1 unread)" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Mark as read" }));
  await waitFor(() => expect(item.classList.contains("is-unread")).toBe(false));
  expect(screen.getByText(row.message).closest(".nitem")).toBe(item);
  expect(screen.queryByText("Read", { exact: true })).toBeNull();
  expect(fetchMock.mock.calls.filter(([url]) => url.startsWith("/api/notifications") && url !== "/api/notifications/read").length).toBe(readsBefore);
  expect(screen.getByRole("link", { name: "Notifications" })).toBeTruthy();
  const call = fetchMock.mock.calls.find(([url]) => url === "/api/notifications/read");
  expect(JSON.parse(call[1].body)).toEqual({ ids: [row.id] });
  expect(call[1].headers.Authorization).toBe("Bearer access");
});

it("counts unread notifications beyond the page and marks all pages read", async () => {
  const { fetchMock } = setup({ many: true });
  await screen.findByText("Update 0");
  expect(screen.getByRole("link", { name: "Notifications (26 unread)" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  const item = (await screen.findByText("Update 25")).closest(".nitem");
  const requestsBefore = fetchMock.mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Mark all read" }));
  await waitFor(() => expect(item.classList.contains("is-unread")).toBe(false));
  expect(fetchMock.mock.calls.length).toBe(requestsBefore + 1);
  expect(screen.getByRole("link", { name: "Notifications" })).toBeTruthy();
  expect(JSON.parse(fetchMock.mock.calls.find(([url]) => url === "/api/notifications/read")[1].body)).toEqual({ ids: null });
});

it("offers retry for failed reads and never claims a failed write succeeded", async () => {
  const { recover } = setup({ failRead: true, failWrite: true });
  await screen.findByRole("alert");
  expect(screen.queryByText(row.message)).toBeNull();
  recover();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByText(row.message);
  fireEvent.click(screen.getByRole("button", { name: "Mark as read" }));
  await screen.findByText(/Refresh to check the saved read status/);
  await screen.findByRole("button", { name: "Mark as read" });
  expect(screen.queryByText("Notification marked as read.")).toBeNull();
  expect(screen.getByText(row.message).closest(".nitem").classList.contains("is-unread")).toBe(true);
});

it("marks only the selected item without disturbing other unread notifications", async () => {
  const { fetchMock } = setup({ many: true });
  const first = (await screen.findByText("Update 0")).closest(".nitem");
  const second = screen.getByText("Update 1").closest(".nitem");
  const requestsBefore = fetchMock.mock.calls.length;
  fireEvent.click(first.querySelector("button"));
  await waitFor(() => expect(first.classList.contains("is-unread")).toBe(false));
  expect(second.classList.contains("is-unread")).toBe(true);
  expect(screen.getByRole("link", { name: "Notifications (25 unread)" })).toBeTruthy();
  expect(fetchMock.mock.calls.length).toBe(requestsBefore + 1);
});

it("ignores delayed results from a previous account and clears on sign-out", async () => {
  let resolveOld;
  const read = vi.fn(path => path.endsWith("unread-count") ? Promise.resolve({ count: 0 }) : new Promise(resolve => { resolveOld = resolve; }));
  const write = vi.fn();
  const { result, rerender } = renderHook(({ owner }) => useNotifications(owner, read, write), { initialProps: { owner: "old" } });
  const old = resolveOld;
  rerender({ owner: "new" });
  await act(async () => { old([row]); resolveOld([]); });
  await waitFor(() => expect(result.current.notificationsLoading).toBe(false));
  expect(result.current.notifications).toEqual([]);
  rerender({ owner: null });
  expect(result.current.unreadNotificationCount).toBeNull();
});
