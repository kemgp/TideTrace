import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

it("routes authentication and uploads to the hosted API without changing credentials or file bytes", async () => {
  vi.stubEnv("VITE_API_URL", "https://tidetrace-api.example/");
  vi.resetModules();
  const fetchMock = vi.fn(async () => ({ status: 200, ok: true, json: async () => ({ data: {} }) }));
  vi.stubGlobal("fetch", fetchMock);
  const { authRequest } = await import("../src/api/auth.js");
  const { requestData } = await import("../src/api/data.js");
  await authRequest("me", { token: "test-token" });
  const file = new File(["photo"], "photo.png", { type: "image/png" });
  await requestData("traces/123/media", { method: "POST", token: "test-token", file });
  expect(fetchMock.mock.calls[0][0]).toBe("https://tidetrace-api.example/api/auth/me");
  expect(fetchMock.mock.calls[1][0]).toBe("https://tidetrace-api.example/api/traces/123/media");
  expect(fetchMock.mock.calls[1][1]).toMatchObject({ body: file, headers: { Authorization: "Bearer test-token", "Content-Type": "image/png" } });
});

it("keeps local requests relative and rejects an API URL containing a path", async () => {
  vi.stubEnv("VITE_API_URL", "");
  vi.resetModules();
  expect((await import("../src/api/url.js")).apiUrl("categories")).toBe("/api/categories");
  vi.stubEnv("VITE_API_URL", "https://api.example/api");
  vi.resetModules();
  await expect(import("../src/api/url.js")).rejects.toThrow("VITE_API_URL");
});
