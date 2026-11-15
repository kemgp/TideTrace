import { expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import useNotifications from "../src/hooks/useNotifications.js";

const row = (id) => ({ id, message: `Notice ${id}`, created_at: "2026-11-15T10:00:00Z", read_at: null });

it("keeps showing the current list while a focus refresh is running", async () => {
  let release = null;
  let first = true;
  const readData = vi.fn((path) => {
    if (path.startsWith("notifications/unread-count")) return Promise.resolve({ count: 1 });
    if (first) { first = false; return Promise.resolve([row("a")]); }
    return new Promise((resolve) => { release = () => resolve([row("a"), row("b")]); });
  });
  const { result } = renderHook(() => useNotifications("user-1", readData, vi.fn()));
  await waitFor(() => expect(result.current.notifications).toHaveLength(1));
  act(() => { window.dispatchEvent(new Event("focus")); });
  await waitFor(() => expect(release).not.toBeNull());
  // The refresh has not answered yet: the old list stays, with no loading state.
  expect(result.current.notificationsLoading).toBe(false);
  expect(result.current.notifications).toHaveLength(1);
  await act(async () => { release(); });
  await waitFor(() => expect(result.current.notifications).toHaveLength(2));
});

it("does not show one account's list to another while loading", async () => {
  const readData = vi.fn((path) => path.startsWith("notifications/unread-count") ? Promise.resolve({ count: 1 }) : new Promise(() => {}));
  const first = vi.fn((path) => path.startsWith("notifications/unread-count") ? Promise.resolve({ count: 1 }) : Promise.resolve([row("a")]));
  const { result, rerender } = renderHook(({ owner, read }) => useNotifications(owner, read, vi.fn()), { initialProps: { owner: "user-1", read: first } });
  await waitFor(() => expect(result.current.notifications).toHaveLength(1));
  rerender({ owner: "user-2", read: readData });
  expect(result.current.notifications).toHaveLength(0);
  expect(result.current.notificationsLoading).toBe(true);
});
