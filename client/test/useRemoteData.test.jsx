import { expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useApp } from "../src/context/AppContext.jsx";
import useRemoteData from "../src/hooks/useRemoteData.js";
vi.mock("../src/context/AppContext.jsx", () => ({ useApp: vi.fn() }));

const hook = (options) => renderHook(({ path }) => useRemoteData(path, { collection: true, ...options }), { initialProps: { path: "a" } });

it("keeps the last list while the next request runs when keepPrevious is set", async () => {
  let finish;
  const readData = vi.fn((path) => path === "a" ? Promise.resolve([{ id: 1 }]) : new Promise((resolve) => { finish = resolve; }));
  useApp.mockReturnValue({ readData, profile: { id: "me" } });
  const { result, rerender } = hook({ keepPrevious: true });
  expect(result.current.loading).toBe(true);
  await waitFor(() => expect(result.current.data).toEqual([{ id: 1 }]));
  rerender({ path: "b" });
  expect(result.current).toMatchObject({ data: [{ id: 1 }], loading: false, refreshing: true });
  await act(async () => finish([{ id: 2 }]));
  expect(result.current).toMatchObject({ data: [{ id: 2 }], loading: false, refreshing: false });
});

it("goes back to loading by default and never reuses another account's list", async () => {
  const readData = vi.fn(() => new Promise(() => {}));
  readData.mockImplementationOnce(() => Promise.resolve([{ id: 1 }]));
  useApp.mockReturnValue({ readData, profile: { id: "me" } });
  const plain = hook({});
  await waitFor(() => expect(plain.result.current.data).toEqual([{ id: 1 }]));
  plain.rerender({ path: "b" });
  expect(plain.result.current).toMatchObject({ data: null, loading: true, refreshing: false });
  readData.mockImplementationOnce(() => Promise.resolve([{ id: 1 }]));
  const kept = hook({ keepPrevious: true });
  await waitFor(() => expect(kept.result.current.data).toEqual([{ id: 1 }]));
  useApp.mockReturnValue({ readData, profile: { id: "someone-else" } });
  kept.rerender({ path: "a" });
  expect(kept.result.current).toMatchObject({ data: null, loading: true, refreshing: false });
});
