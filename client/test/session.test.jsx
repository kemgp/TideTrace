import React, { StrictMode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import App from "../src/App.jsx";
import { createSessionManager, SESSION_KEY } from "../src/api/session.js";

const profile = (role = "user", status = "active") => ({ id: "member-id", display_name: "Session Member", email: "member@example.test", role, status });
const session = (remaining = 3600, suffix = "one") => ({ access_token: `access-${suffix}`, refresh_token: `refresh-${suffix}`, expires_at: Math.floor(Date.now() / 1000) + remaining });
const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => ({ data }) });
const failure = (code, status) => ({ ok: false, status, json: async () => ({ error: { code, message: code } }) });
const saves = (value, storage = window.sessionStorage) => storage.setItem(SESSION_KEY, JSON.stringify(value));
const stops = [];
afterEach(() => { stops.splice(0).forEach((stop) => stop()); });

function api(handler = () => undefined) {
  const mock = vi.fn(async (url, options) => {
    const result = await handler(url, options);
    if (result) return result;
    if (url === "/api/auth/me") return response(profile());
    if (url === "/api/auth/logout") return response(null, 204);
    if (url.startsWith("/api/contributions?")) return response([]);
    throw new Error(`Unexpected request ${url}`);
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

function sharedLocks() {
  let queue = Promise.resolve();
  const request = vi.fn((_name, fn) => {
    const operation = queue.then(fn);
    queue = operation.catch(() => {});
    return operation;
  });
  vi.stubGlobal("navigator", { locks: { request } });
  return request;
}

function Location() { return <output data-testid="route">{useLocation().pathname}</output>; }
function open(path = "/user/contributions") {
  return render(<StrictMode><MemoryRouter initialEntries={[path]}><App /><Location /></MemoryRouter></StrictMode>);
}

it("restores a protected deep link on reload without redirecting to login", async () => {
  saves(session());
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const calls = api((url) => url === "/api/auth/me" ? pending : undefined);
  const view = open();
  expect(screen.getByText("Restoring your session…").getAttribute("role")).toBe("status");
  expect(screen.getByTestId("route").textContent).toBe("/user/contributions");
  await act(async () => finish(response(profile())));
  expect(await screen.findByText(/Signed in as Session Member/)).toBeTruthy();
  expect(calls.mock.calls.filter(([url]) => url === "/api/auth/me")).toHaveLength(1);
  view.unmount();
  open();
  expect(await screen.findByText(/Signed in as Session Member/)).toBeTruthy();
  expect(screen.getByTestId("route").textContent).toBe("/user/contributions");
});

it("refreshes an expired saved session once and persists both rotated tokens", async () => {
  saves(session(-20));
  const rotated = session(3600, "two");
  const calls = api((url) => url === "/api/auth/refresh" ? response({ session: rotated }) : undefined);
  const manager = createSessionManager();
  await Promise.all([manager.retrySession(), manager.retrySession(), manager.retrySession()]);
  expect(calls.mock.calls.filter(([url]) => url.endsWith("/refresh"))).toHaveLength(1);
  expect(JSON.parse(calls.mock.calls[0][1].body)).toEqual({ refresh_token: "refresh-one" });
  expect(calls.mock.calls[1][1].headers.Authorization).toBe("Bearer access-two");
  expect(JSON.parse(window.sessionStorage.getItem(SESSION_KEY))).toEqual(rotated);
  expect(manager.getSnapshot().account.role).toBe("user");
});

it("automatically renews before expiry and uses the current database role", async () => {
  vi.useFakeTimers();
  saves(session(90));
  let role = "user";
  const calls = api((url) => {
    if (url.endsWith("/refresh")) return response({ session: session(3600, "two") });
    if (url.endsWith("/me")) return response(profile(role));
  });
  const manager = createSessionManager();
  stops.push(manager.start());
  await manager.retrySession();
  role = "moderator";
  await vi.advanceTimersByTimeAsync(30000);
  expect(manager.getSnapshot().account.role).toBe("mod");
  expect(manager.getSnapshot().account.accessToken).toBe("access-two");
  expect(calls.mock.calls.filter(([url]) => url.endsWith("/refresh"))).toHaveLength(1);
});

it("refreshes once when the backend rejects a locally unexpired access token", async () => {
  saves(session());
  const calls = api((url, options) => {
    if (url.endsWith("/refresh")) return response({ session: session(3600, "two") });
    if (options.headers.Authorization === "Bearer access-one") return failure("UNAUTHENTICATED", 401);
  });
  const manager = createSessionManager();
  await manager.retrySession();
  expect(manager.getSnapshot().account.accessToken).toBe("access-two");
  expect(calls).toHaveBeenCalledTimes(3);
});

it.each(["SESSION_EXPIRED", "UNAUTHENTICATED"])("clears revoked sessions (%s)", async (code) => {
  saves(session(-1));
  api(() => failure(code, 401));
  const manager = createSessionManager();
  await manager.retrySession();
  expect(manager.getSnapshot()).toMatchObject({ account: null, ready: true, error: "", notice: expect.stringMatching(/session has ended/) });
  expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull();
});

it("checks roles and suspension against the backend instead of saved profile fields", async () => {
  saves({ ...session(), role: "admin", profile: profile("admin") });
  api(() => response(profile("user", "suspended")));
  const manager = createSessionManager();
  await manager.retrySession();
  expect(manager.getSnapshot().account).toBeNull();
  expect(manager.getSnapshot().notice).toMatch(/suspended/);
  expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull();
});

it("keeps saved tokens during an outage and lets the user retry on the same route", async () => {
  const saved = session();
  saves(saved);
  let offline = true;
  api(() => offline ? failure("UPSTREAM_UNAVAILABLE", 502) : undefined);
  open();
  expect((await screen.findByRole("alert")).textContent).toMatch(/reconnect/);
  expect(screen.getByTestId("route").textContent).toBe("/user/contributions");
  expect(JSON.parse(window.sessionStorage.getItem(SESSION_KEY))).toEqual(saved);
  offline = false;
  fireEvent.click(screen.getByRole("button", { name: "Retry connection" }));
  expect(await screen.findByText(/Signed in as Session Member/)).toBeTruthy();
});

it("retains rotated tokens when the subsequent profile request fails", async () => {
  saves(session(-1));
  const rotated = session(3600, "two");
  let offline = true;
  const calls = api((url) => {
    if (url.endsWith("/refresh")) return response({ session: rotated });
    if (offline) return failure("UPSTREAM_UNAVAILABLE", 502);
  });
  const manager = createSessionManager();
  await manager.retrySession();
  expect(JSON.parse(window.sessionStorage.getItem(SESSION_KEY))).toEqual(rotated);
  expect(manager.getSnapshot().account).toBeNull();
  offline = false;
  await manager.retrySession();
  expect(manager.getSnapshot().account.accessToken).toBe("access-two");
  expect(calls.mock.calls.filter(([url]) => url.endsWith("/refresh"))).toHaveLength(1);
});

it("does not restore a session when logout happens during refresh", async () => {
  saves(session(-1));
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const calls = api((url) => url.endsWith("/refresh") ? pending : undefined);
  const manager = createSessionManager();
  const restore = manager.retrySession();
  await waitFor(() => expect(calls).toHaveBeenCalledTimes(1));
  await manager.logout();
  finish(response({ session: session(3600, "two") }));
  await restore;
  expect(manager.getSnapshot().account).toBeNull();
  expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull();
});

it("does not complete a pending login after local sign-out", async () => {
  api();
  const manager = createSessionManager();
  let finish;
  const login = manager.authenticate(() => new Promise((resolve) => { finish = resolve; }));
  manager.clearSession();
  finish(session());
  await expect(login).rejects.toMatchObject({ code: "CANCELLED" });
  expect(manager.getSnapshot().account).toBeNull();
  expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull();
});

it("coordinates refresh across tabs and shares persistent login on supported browsers", async () => {
  const locks = sharedLocks();
  saves(session(-1), window.localStorage);
  const calls = api((url) => url.endsWith("/refresh") ? response({ session: session(3600, "two") }) : undefined);
  const first = createSessionManager();
  const second = createSessionManager();
  await Promise.all([first.retrySession(), second.retrySession()]);
  expect(locks).toHaveBeenCalled();
  expect(calls.mock.calls.filter(([url]) => url.endsWith("/refresh"))).toHaveLength(1);
  expect(first.getSnapshot().account.accessToken).toBe("access-two");
  expect(second.getSnapshot().account.accessToken).toBe("access-two");
  expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull();
});

it("clears other tabs on sign-out and rejects their late profile responses", async () => {
  sharedLocks();
  saves(session(), window.localStorage);
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const calls = api((url) => url === "/api/auth/me" ? pending : undefined);
  const manager = createSessionManager();
  stops.push(manager.start());
  await waitFor(() => expect(calls).toHaveBeenCalledTimes(1));
  window.localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new StorageEvent("storage", { key: SESSION_KEY, newValue: null, storageArea: window.localStorage }));
  finish(response(profile("admin")));
  await manager.retrySession();
  expect(manager.getSnapshot().account).toBeNull();
  expect(window.localStorage.getItem(SESSION_KEY)).toBeNull();
});

it("rejects malformed saved data without contacting the backend", async () => {
  window.sessionStorage.setItem(SESSION_KEY, "not-json");
  const calls = api();
  const manager = createSessionManager();
  await manager.retrySession();
  expect(manager.getSnapshot().account).toBeNull();
  expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull();
  expect(calls).not.toHaveBeenCalled();
});

it("keeps login usable in memory when browser storage is blocked", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Blocked"); });
  api();
  const manager = createSessionManager();
  await manager.authenticate(() => session());
  expect(manager.getSnapshot().account.role).toBe("user");
  await manager.retrySession();
  expect(manager.getSnapshot().account.role).toBe("user");
  await manager.logout();
  expect(manager.getSnapshot().account).toBeNull();
});

it("does not restore saved login over a recovery email link", async () => {
  sharedLocks();
  saves(session(), window.localStorage);
  const calls = api();
  window.history.replaceState({}, "", "/auth/callback#access_token=recovery&refresh_token=recovery-refresh&expires_in=3600&type=recovery");
  open("/auth/callback");
  await screen.findByLabelText("New password");
  expect(screen.queryByText(/Signed in as/)).toBeNull();
  expect(window.localStorage.getItem(SESSION_KEY)).toBeNull();
  expect(calls.mock.calls.every(([url, options]) => url.endsWith("/me") && options.headers.Authorization === "Bearer recovery")).toBe(true);
});

it("persists only tokens after login and rechecks the role when another tab opens", async () => {
  sharedLocks();
  api();
  const first = createSessionManager();
  await first.authenticate(() => ({ ...session(), user: { password: "never-save", role: "admin" } }));
  expect(JSON.parse(window.localStorage.getItem(SESSION_KEY))).toEqual(session());
  const second = createSessionManager();
  expect(second.getSnapshot().account).toBeNull();
  await second.retrySession();
  expect(second.getSnapshot().account.role).toBe("user");
});

it("hides expired accounts during an outage and recovers when the connection returns", async () => {
  vi.useFakeTimers();
  saves(session(90));
  let offline = false;
  api((url) => {
    if (offline) return failure("UPSTREAM_UNAVAILABLE", 502);
    if (url.endsWith("/refresh")) return response({ session: session(3600, "two") });
  });
  const manager = createSessionManager();
  stops.push(manager.start());
  await manager.retrySession();
  offline = true;
  await vi.advanceTimersByTimeAsync(30000);
  expect(manager.getSnapshot().account.role).toBe("user");
  await vi.advanceTimersByTimeAsync(60000);
  expect(manager.getSnapshot().account).toBeNull();
  expect(manager.getSnapshot().error).toMatch(/reconnect/);
  expect(window.sessionStorage.getItem(SESSION_KEY)).not.toBeNull();
  offline = false;
  window.dispatchEvent(new Event("online"));
  await manager.retrySession();
  expect(manager.getSnapshot().account.accessToken).toBe("access-two");
});

it("revalidates the account after waking a sleeping tab", async () => {
  vi.useFakeTimers();
  saves(session(90));
  api((url) => url.endsWith("/refresh") ? response({ session: session(3600, "two") }) : undefined);
  const manager = createSessionManager();
  stops.push(manager.start());
  await manager.retrySession();
  vi.setSystemTime(Date.now() + 120000);
  window.dispatchEvent(new Event("focus"));
  expect(manager.getSnapshot().account).toBeNull();
  await manager.retrySession();
  expect(manager.getSnapshot().account.accessToken).toBe("access-two");
});

it("clears saved login even when server logout fails", async () => {
  saves(session());
  api((url) => url.endsWith("/logout") ? failure("UPSTREAM_UNAVAILABLE", 502) : undefined);
  const manager = createSessionManager();
  await manager.retrySession();
  await expect(manager.logout()).rejects.toMatchObject({ status: 502 });
  expect(manager.getSnapshot().account).toBeNull();
  expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull();
});
