import { beforeEach, expect, it, vi } from "vitest";
import { clearReads, invalidateReads, peekRead, sharedRead } from "../src/api/readCache.js";

beforeEach(() => clearReads());
const later = () => { let resolve, reject; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; };

it("identical reads at the same time share one request, and one caller leaving does not cancel it for others", async () => {
  const pending = later();
  const load = vi.fn(() => pending.promise);
  const leaving = new AbortController();
  const first = sharedRead("member-a", "dashboard", load);
  const second = sharedRead("member-a", "dashboard", load, { signal: leaving.signal });
  leaving.abort();
  await expect(second).rejects.toMatchObject({ code: "CANCELLED" });
  pending.resolve({ total: 1 });
  expect(await first).toEqual({ total: 1 });
  expect(load).toHaveBeenCalledTimes(1);
  expect(peekRead("member-a", "dashboard")).toEqual({ total: 1 });
  expect(peekRead("member-b", "dashboard")).toBeUndefined();
});

it("reuses an answer only when it is younger than maxAge, and never keeps a failure", async () => {
  vi.useFakeTimers();
  try {
    const load = vi.fn(async () => ({ total: load.mock.calls.length }));
    await sharedRead("member-a", "dashboard", load);
    expect(await sharedRead("member-a", "dashboard", load, { maxAge: 10000 })).toEqual({ total: 1 });
    expect(await sharedRead("member-a", "dashboard", load)).toEqual({ total: 2 });
    vi.advanceTimersByTime(10001);
    expect(await sharedRead("member-a", "dashboard", load, { maxAge: 10000 })).toEqual({ total: 3 });
    vi.advanceTimersByTime(5 * 60 * 1000);
    expect(peekRead("member-a", "dashboard")).toBeUndefined();
    await expect(sharedRead("member-a", "traces", async () => { throw new Error("down"); })).rejects.toThrow("down");
    expect(peekRead("member-a", "traces")).toBeUndefined();
  } finally { vi.useRealTimers(); }
});

it("a save drops this account's copies, and a read already running when it happened is not kept", async () => {
  await sharedRead("member-a", "contributions", async () => ["old"]);
  await sharedRead("member-b", "contributions", async () => ["other"]);
  const pending = later();
  const running = sharedRead("member-a", "dashboard", () => pending.promise);
  invalidateReads("member-a");
  expect(peekRead("member-a", "contributions")).toBeUndefined();
  expect(peekRead("member-b", "contributions")).toEqual(["other"]);
  const fresh = vi.fn(async () => ({ total: 2 }));
  expect(await sharedRead("member-a", "dashboard", fresh)).toEqual({ total: 2 });
  expect(fresh).toHaveBeenCalledTimes(1);
  pending.resolve({ total: 1 });
  expect(await running).toEqual({ total: 1 });
  expect(peekRead("member-a", "dashboard")).toEqual({ total: 2 });
  clearReads();
  expect(peekRead("member-b", "contributions")).toBeUndefined();
});

it("starts the request before returning, like a plain read, so a click's request is sent at once", async () => {
  const load = vi.fn(async () => []);
  const read = sharedRead("member-a", "tides?progress=incomplete", load);
  expect(load).toHaveBeenCalledTimes(1);
  await read;
  await expect(sharedRead("member-a", "broken", () => { throw new Error("sync failure"); })).rejects.toThrow("sync failure");
});
