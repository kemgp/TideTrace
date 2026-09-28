import { it, expect, vi, afterEach } from "vitest";
afterEach(() => {
  document.querySelectorAll('script[src^="https://maps.googleapis.com/"]').forEach((script) => script.remove());
  delete window.__tidetraceMapsReady;
  delete window.gm_authFailure;
  delete window.google;
  vi.unstubAllEnvs();
});
async function loader() {
  vi.resetModules();
  vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "test-browser-key");
  return import("../src/api/maps.js");
}
it("shares one script and waits for both libraries before resolving", async () => {
  const { loadMaps } = await loader();
  const first = loadMaps();
  expect(loadMaps()).toBe(first);
  const scripts = document.querySelectorAll('script[src^="https://maps.googleapis.com/"]');
  expect(scripts).toHaveLength(1);
  const importLibrary = vi.fn().mockResolvedValue({});
  window.google = { maps: { importLibrary } };
  await window.__tidetraceMapsReady();
  await expect(first).resolves.toBe(window.google.maps);
  expect(importLibrary.mock.calls).toEqual([["maps"], ["marker"]]);
});
it("rejects timeouts and safely ignores late callbacks", async () => {
  vi.useFakeTimers();
  const { loadMaps } = await loader();
  const promise = loadMaps();
  const rejected = expect(promise).rejects.toThrow(/too long/);
  await vi.advanceTimersByTimeAsync(20000);
  await rejected;
  expect(() => window.__tidetraceMapsReady()).not.toThrow();
});
it("reports authentication failures to mounted maps and subsequent requests", async () => {
  const { loadMaps, onMapAuthFailure } = await loader();
  const listener = vi.fn();
  const unsubscribe = onMapAuthFailure(listener);
  const promise = loadMaps();
  const rejected = expect(promise).rejects.toThrow(/access is unavailable/);
  window.gm_authFailure();
  await rejected;
  expect(listener).toHaveBeenCalledTimes(1);
  await expect(loadMaps()).rejects.toThrow(/access is unavailable/);
  unsubscribe();
});
it("does not request Google without a key", async () => {
  const { loadMaps } = await loader();
  vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "");
  await expect(loadMaps()).rejects.toThrow(/not available/);
  expect(document.querySelector('script[src^="https://maps.googleapis.com/"]')).toBeNull();
});
