import React, { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter, MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import App from "../src/App.jsx";
import { authRequest, loadAccount } from "../src/api/auth.js";

const email = "member@example.test";
const password = "correct-password";
const session = () => ({ access_token: "test-access-token", refresh_token: "test-refresh-token", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600 });
const profile = (role = "user", status = "active") => ({ id: "member-id", display_name: "Test Member", email, role, status });
const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => ({ data }) });
const failure = (code, message, status = 400) => ({ ok: false, status, json: async () => ({ error: { code, message } }) });

function mockApi(handler) {
  const mock = vi.fn(async (url, options) => {
    const result = await handler(url, options);
    if (!result) throw new Error(`Unexpected test request: ${url}`);
    return result;
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

function RouteProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><output data-testid="route">{location.pathname}</output><button onClick={() => navigate("/admin/dashboard")}>Test admin route</button></>;
}

function openApp(path = "/login") {
  return render(<MemoryRouter initialEntries={[path]}><App /><RouteProbe /></MemoryRouter>);
}

async function submitLogin(user) {
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password", { exact: true }), password);
  const form = screen.getByLabelText("Email").closest("form");
  await user.click(within(form).getByRole("button", { name: "Log in", exact: true }));
}

async function submitRegistration(user) {
  await user.type(screen.getByLabelText("Full name"), "Test Member");
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password", { exact: true }), password);
  await user.click(screen.getByRole("button", { name: "Create account" }));
}

describe("backend authentication", () => {
  it.each([
    ["user", "/user/dashboard"], ["moderator", "/moderator/dashboard"], ["admin", "/admin/dashboard"],
  ])("routes a verified %s to the correct dashboard", async (role, path) => {
    const calls = mockApi((url) => {
      if (url === "/api/auth/login") return response({ session: session() });
      if (url === "/api/auth/me") return response(profile(role));
    });
    openApp();
    await submitLogin(userEvent.setup());
    await waitFor(() => expect(screen.getByTestId("route").textContent).toBe(path));
    expect(JSON.parse(calls.mock.calls[0][1].body)).toEqual({ email, password });
    expect(calls.mock.calls[1][1].headers.Authorization).toBe("Bearer test-access-token");
    expect(screen.getByText(/Signed in as Test Member/)).toBeTruthy();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("ignores an old or forged saved role", async () => {
    window.localStorage.setItem("tidetrace-role", "admin");
    const calls = mockApi(() => undefined);
    openApp("/admin/dashboard");
    await waitFor(() => expect(screen.getByTestId("route").textContent).toBe("/login"));
    expect(screen.getByRole("heading", { name: "Welcome to TideTrace" })).toBeTruthy();
    expect(calls).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("tidetrace-role")).toBeNull();
  });

  it("never authenticates invalid credentials", async () => {
    const calls = mockApi(() => failure("INVALID_CREDENTIALS", "The email or password is incorrect.", 401));
    openApp();
    await submitLogin(userEvent.setup());
    expect((await screen.findByRole("alert")).textContent).toMatch(/incorrect/);
    expect(screen.getByTestId("route").textContent).toBe("/login");
    expect(calls).toHaveBeenCalledTimes(1);
  });

  it("waits for the database profile before granting access", async () => {
    let finishProfile;
    const pending = new Promise((resolve) => { finishProfile = resolve; });
    mockApi((url) => url === "/api/auth/login" ? response({ session: session() }) : pending);
    openApp();
    await submitLogin(userEvent.setup());
    expect(screen.getByTestId("route").textContent).toBe("/login");
    expect(screen.getByRole("button", { name: "Signing in…" }).disabled).toBe(true);
    await act(async () => { finishProfile(response(profile("admin"))); });
    await waitFor(() => expect(screen.getByTestId("route").textContent).toBe("/admin/dashboard"));
  });

  it("rejects suspended accounts even when password login succeeds", async () => {
    mockApi((url) => url === "/api/auth/login" ? response({ session: session() }) : response(profile("admin", "suspended")));
    openApp();
    await submitLogin(userEvent.setup());
    expect((await screen.findByRole("alert")).textContent).toMatch(/suspended/);
    expect(screen.getByTestId("route").textContent).toBe("/login");
  });

  it("prevents members from entering the admin route", async () => {
    mockApi((url) => url === "/api/auth/login" ? response({ session: session() }) : response(profile()));
    openApp();
    const user = userEvent.setup();
    await submitLogin(user);
    await waitFor(() => expect(screen.getByTestId("route").textContent).toBe("/user/dashboard"));
    await user.click(screen.getByRole("button", { name: "Test admin route" }));
    await waitFor(() => expect(screen.getByTestId("route").textContent).toBe("/user/dashboard"));
  });

  it("registers with supported fields and requires real email verification", async () => {
    let codeValid = false;
    const calls = mockApi((url) => {
      if (url === "/api/auth/register") return response({ session: null, user: { id: "member-id" } });
      if (url === "/api/auth/verify") return codeValid ? response({ session: session() }) : failure("INVALID_VERIFICATION_CODE", "That verification code is invalid or expired.");
      if (url === "/api/auth/me") return response(profile());
    });
    openApp("/register");
    const user = userEvent.setup();
    await submitRegistration(user);
    expect(await screen.findByRole("heading", { name: "Confirm your email" })).toBeTruthy();
    expect(JSON.parse(calls.mock.calls[0][1].body)).toEqual({ display_name: "Test Member", email, password });
    expect(screen.queryByText(/Demo code:/)).toBeNull();
    await user.type(screen.getByLabelText("Verification code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify email" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/invalid or expired/);
    expect(screen.getByTestId("route").textContent).toBe("/register");
    codeValid = true;
    await user.clear(screen.getByLabelText("Verification code"));
    await user.type(screen.getByLabelText("Verification code"), "654321");
    await user.click(screen.getByRole("button", { name: "Verify email" }));
    await waitFor(() => expect(screen.getByTestId("route").textContent).toBe("/user/dashboard"));
    const verification = calls.mock.calls.filter(([url]) => url === "/api/auth/verify");
    expect(JSON.parse(verification[1][1].body)).toEqual({ email, token: "654321", type: "signup" });
  });

  it("supports projects with confirmation disabled by validating the returned session", async () => {
    mockApi((url) => url === "/api/auth/register" ? response({ session: session() }) : response(profile()));
    openApp("/register");
    await submitRegistration(userEvent.setup());
    await waitFor(() => expect(screen.getByTestId("route").textContent).toBe("/user/dashboard"));
  });

  it("lets unconfirmed users resend and only starts cooldown after success", async () => {
    let resendWorks = false;
    const calls = mockApi((url) => {
      if (url === "/api/auth/login") return failure("EMAIL_NOT_CONFIRMED", "Confirm your email before signing in.", 403);
      if (url === "/api/auth/resend") return resendWorks ? response({ message: "Sent" }) : failure("RATE_LIMITED", "Please try again later.", 429);
    });
    openApp();
    const user = userEvent.setup();
    await submitLogin(user);
    await screen.findByRole("heading", { name: "Confirm your email" });
    await user.click(screen.getByRole("button", { name: "Resend confirmation email" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/try again later/);
    expect(screen.getByRole("button", { name: "Resend confirmation email" }).disabled).toBe(false);
    resendWorks = true;
    await user.click(screen.getByRole("button", { name: "Resend confirmation email" }));
    expect((await screen.findByRole("button", { name: /Resend email in/ })).disabled).toBe(true);
    expect(JSON.parse(calls.mock.calls.at(-1)[1].body)).toEqual({ email });
  });

  it("clears the local account and calls server logout", async () => {
    const calls = mockApi((url) => {
      if (url === "/api/auth/login") return response({ session: session() });
      if (url === "/api/auth/me") return response(profile("admin"));
      if (url === "/api/auth/logout") return response(null, 204);
    });
    const view = openApp();
    const user = userEvent.setup();
    await submitLogin(user);
    await user.click(await screen.findByRole("button", { name: "Log out" }));
    await waitFor(() => expect(screen.getByTestId("route").textContent).toBe("/login"));
    const logout = calls.mock.calls.find(([url]) => url === "/api/auth/logout");
    expect(logout[1].headers.Authorization).toBe("Bearer test-access-token");
    view.unmount();
    openApp("/admin/dashboard");
    await waitFor(() => expect(screen.getByTestId("route").textContent).toBe("/login"));
  });

  it("shows a useful message when the backend cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    openApp();
    await submitLogin(userEvent.setup());
    expect((await screen.findByRole("alert")).textContent).toMatch(/Cannot reach the sign-in service/);
  });

  it("consumes confirmation links once in StrictMode and removes tokens from the URL", async () => {
    const calls = mockApi((url) => url === "/api/auth/me" ? response(profile("admin")) : undefined);
    window.history.replaceState({}, "", "/auth/callback#access_token=test-access-token&refresh_token=private&expires_in=3600&type=signup");
    render(<StrictMode><BrowserRouter><App /><RouteProbe /></BrowserRouter></StrictMode>);
    await waitFor(() => expect(screen.getByTestId("route").textContent).toBe("/admin/dashboard"));
    expect(window.location.hash).toBe("");
    expect(calls).toHaveBeenCalledTimes(1);
    expect(window.localStorage.length).toBe(0);
  });

  it("also handles confirmation links redirected to the site root", async () => {
    mockApi((url) => url === "/api/auth/me" ? response(profile()) : undefined);
    window.history.replaceState({}, "", "/#access_token=test-access-token&expires_in=3600&type=signup");
    render(<BrowserRouter><App /><RouteProbe /></BrowserRouter>);
    await waitFor(() => expect(screen.getByTestId("route").textContent).toBe("/user/dashboard"));
    expect(window.location.hash).toBe("");
  });

  it("handles expired confirmation links without signing in", async () => {
    const calls = mockApi(() => undefined);
    window.history.replaceState({}, "", "/auth/callback#error=access_denied&error_code=otp_expired");
    render(<BrowserRouter><App /></BrowserRouter>);
    expect((await screen.findByRole("alert")).textContent).toMatch(/invalid or expired/);
    expect(window.location.hash).toBe("");
    expect(calls).not.toHaveBeenCalled();
  });

  it("offers password recovery from the login form", async () => {
    openApp();
    await userEvent.setup().click(screen.getByRole("link", { name: "Forgot password?" }));
    expect(screen.getByTestId("route").textContent).toBe("/forgot-password");
    expect(screen.getByRole("button", { name: "Send recovery email" })).toBeTruthy();
  });
});

describe("auth response validation", () => {
  it("rejects unrecognized roles and expired sessions", async () => {
    mockApi(() => response(profile("owner")));
    await expect(loadAccount(session())).rejects.toMatchObject({ code: "INVALID_PROFILE" });
    mockApi(() => response(profile()));
    await expect(loadAccount({ ...session(), expires_at: 1 })).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
  });

  it("handles non-JSON proxy errors without displaying server output", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 502, ok: false, json: async () => { throw new Error("Internal proxy output"); } }));
    await expect(authRequest("login", { body: { email, password } })).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });
});
