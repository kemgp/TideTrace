import { afterEach, expect, it, vi } from "vitest";
import { requestData } from "../src/api/data.js";
import { authRequest } from "../src/api/auth.js";

const ok = () => ({ ok: true, status: 200, json: async () => ({ data: { status: "ok" } }) });
afterEach(() => vi.unstubAllGlobals());

// `cache: "no-store"` makes Chrome and Firefox skip the CORS preflight cache, so the API's
// Access-Control-Max-Age would never be used. The API's own Cache-Control: no-store keeps answers out of the cache.
it("calls the API without a cache mode, so the browser can reuse its CORS preflight answer", async () => {
  const calls = vi.fn(async () => ok());
  vi.stubGlobal("fetch", calls);
  await requestData("dashboard", { token: "t" });
  await requestData("traces", { token: "t", method: "POST", body: { title: "x" } });
  await authRequest("me", { token: "t" });
  expect(calls).toHaveBeenCalledTimes(3);
  for (const [, options] of calls.mock.calls) expect(options).not.toHaveProperty("cache");
});
