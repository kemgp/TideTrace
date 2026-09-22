import React, { StrictMode } from "react";
import { expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter, useLocation } from "react-router-dom";
import App from "../src/App.jsx";

const email = "admin@example.test";
const newPassword = "a-new-strong-password-42";
const account = { id: "admin-id", email, display_name: "Admin", role: "admin", status: "active" };
const session = { access_token: "recovery-access", expires_in: 3600 };
const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => ({ data }) });
const failure = (code, message, status = 400) => ({ ok: false, status, json: async () => ({ error: { code, message } }) });

function mockApi(handler) {
  const calls = vi.fn(async (url, options) => {
    const custom = await handler(url, options);
    if (custom) return custom;
    if (url === "/api/auth/me") return response(account);
    if (url === "/api/auth/logout") return response(null, 204);
    throw new Error(`Unexpected test request: ${url}`);
  });
  vi.stubGlobal("fetch", calls);
  return calls;
}

function Location() {
  return <output data-testid="route">{useLocation().pathname}</output>;
}

function open(path = "/forgot-password") {
  window.history.replaceState({}, "", path);
  return render(<StrictMode><BrowserRouter><App /><Location /></BrowserRouter></StrictMode>);
}

function recoveryLink(extra = "") {
  return `/auth/callback#access_token=recovery-access&refresh_token=private-refresh&expires_in=3600&type=recovery${extra}`;
}

async function requestEmail(user) {
  await user.type(screen.getByLabelText("Email"), email);
  await user.click(screen.getByRole("button", { name: "Send recovery email" }));
}

async function enterPassword(user, confirm = newPassword) {
  await user.type(await screen.findByLabelText("New password"), newPassword);
  await user.type(screen.getByLabelText("Confirm new password"), confirm);
  await user.click(screen.getByRole("button", { name: "Update password" }));
}

it("requests recovery without claiming that an account exists", async () => {
  const calls = mockApi(() => response({ message: "If the account exists, recovery instructions will be sent." }));
  open();
  await requestEmail(userEvent.setup());
  expect(await screen.findByRole("heading", { name: "Check your email" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Resend email in 60s" }).disabled).toBe(true);
  expect(screen.getByText(/If an account exists for admin@example.test/)).toBeTruthy();
  expect(calls.mock.calls[0][0]).toBe("/api/auth/forgot-password");
  expect(JSON.parse(calls.mock.calls[0][1].body)).toEqual({ email });
});

it("shows request failures and allows a retry", async () => {
  let succeed = false;
  mockApi(() => succeed ? response({}) : failure("RATE_LIMITED", "Too many requests. Please try again later.", 429));
  open();
  const user = userEvent.setup();
  await requestEmail(user);
  expect((await screen.findByRole("alert")).textContent).toMatch(/Too many requests/);
  expect(screen.queryByRole("heading", { name: "Check your email" })).toBeNull();
  succeed = true;
  await user.click(screen.getByRole("button", { name: "Send recovery email" }));
  expect(await screen.findByRole("heading", { name: "Check your email" })).toBeTruthy();
});

it("checks a recovery link once, clears URL tokens, and does not grant dashboard access", async () => {
  const calls = mockApi(() => undefined);
  open(recoveryLink());
  await screen.findByLabelText("New password");
  expect(window.location.hash).toBe("");
  expect(screen.getByTestId("route").textContent).toBe("/auth/callback");
  expect(screen.queryByText(/Signed in as/)).toBeNull();
  expect(screen.getByText(`Choose a new password for ${email}.`)).toBeTruthy();
  expect(calls).toHaveBeenCalledTimes(1);
  expect(calls.mock.calls[0][1].headers.Authorization).toBe("Bearer recovery-access");
  expect(window.localStorage.length).toBe(0);
  expect(window.sessionStorage.length).toBe(0);
});

it("blocks mismatched passwords before making an update request", async () => {
  const calls = mockApi(() => undefined);
  open(recoveryLink());
  await enterPassword(userEvent.setup(), "different-password");
  expect((await screen.findByRole("alert")).textContent).toMatch(/do not match/);
  expect(calls.mock.calls.some(([url]) => url === "/api/auth/password")).toBe(false);
});

it("saves the new password with the recovery token then returns to login", async () => {
  const calls = mockApi((url) => url === "/api/auth/password" ? response(null, 204) : undefined);
  open(recoveryLink());
  const user = userEvent.setup();
  await enterPassword(user);
  expect(await screen.findByRole("heading", { name: "Password updated" })).toBeTruthy();
  const update = calls.mock.calls.find(([url]) => url === "/api/auth/password");
  expect(update[1].method).toBe("PUT");
  expect(update[1].headers.Authorization).toBe("Bearer recovery-access");
  expect(JSON.parse(update[1].body)).toEqual({ password: newPassword });
  expect(calls.mock.calls.some(([url]) => url === "/api/auth/logout")).toBe(true);
  await user.click(screen.getByRole("link", { name: "Back to log in" }));
  await waitFor(() => expect(screen.getByTestId("route").textContent).toBe("/login"));
  expect(screen.queryByText(/Signed in as/)).toBeNull();
});

it("does not report success until the server confirms the update", async () => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  mockApi((url) => url === "/api/auth/password" ? pending : undefined);
  open(recoveryLink());
  await enterPassword(userEvent.setup());
  expect(screen.getByRole("button", { name: "Updating password…" }).disabled).toBe(true);
  expect(screen.queryByRole("heading", { name: "Password updated" })).toBeNull();
  await act(async () => { finish(failure("WEAK_PASSWORD", "Choose a stronger password.")); });
  expect((await screen.findByRole("alert")).textContent).toMatch(/stronger password/);
  expect(screen.queryByRole("heading", { name: "Password updated" })).toBeNull();
  expect(screen.getByRole("button", { name: "Update password" }).disabled).toBe(false);
});

it("supports recovery codes and verifies their type before enabling password entry", async () => {
  let valid = false;
  const calls = mockApi((url) => {
    if (url === "/api/auth/forgot-password") return response({});
    if (url === "/api/auth/verify") return valid ? response({ session }) : failure("INVALID_VERIFICATION_CODE", "Invalid recovery code.");
    if (url === "/api/auth/password") return response(null, 204);
  });
  open();
  const user = userEvent.setup();
  await requestEmail(user);
  await user.type(await screen.findByLabelText("Verification code"), "123456");
  await user.click(screen.getByRole("button", { name: "Verify recovery code" }));
  expect((await screen.findByRole("alert")).textContent).toMatch(/Invalid recovery code/);
  expect(screen.queryByLabelText("New password")).toBeNull();
  valid = true;
  await user.click(screen.getByRole("button", { name: "Verify recovery code" }));
  await screen.findByLabelText("New password");
  const verify = calls.mock.calls.find(([url]) => url === "/api/auth/verify");
  expect(JSON.parse(verify[1].body)).toEqual({ email, token: "123456", type: "recovery" });
  await enterPassword(user);
  expect(await screen.findByRole("heading", { name: "Password updated" })).toBeTruthy();
});

it("can restart recovery after a verified code returns an expired session", async () => {
  mockApi((url) => {
    if (url === "/api/auth/forgot-password") return response({});
    if (url === "/api/auth/verify") return response({ session: { ...session, expires_at: 1 } });
  });
  open();
  const user = userEvent.setup();
  await requestEmail(user);
  await user.type(await screen.findByLabelText("Verification code"), "123456");
  await user.click(screen.getByRole("button", { name: "Verify recovery code" }));
  expect((await screen.findByRole("alert")).textContent).toMatch(/expired/);
  await user.click(screen.getByRole("link", { name: "Request a new recovery email" }));
  expect(await screen.findByRole("button", { name: "Send recovery email" })).toBeTruthy();
  expect(screen.getByLabelText("Email").value).toBe(email);
});

it("rejects expired or forged recovery tokens and offers a fresh email", async () => {
  const calls = mockApi(() => failure("UNAUTHENTICATED", "Your session is invalid or expired.", 401));
  open(recoveryLink());
  expect((await screen.findByRole("alert")).textContent).toMatch(/invalid or expired/);
  expect(screen.queryByLabelText("New password")).toBeNull();
  expect(screen.getByRole("link", { name: "Request a new recovery email" })).toBeTruthy();
  expect(calls).toHaveBeenCalledTimes(1);
});

it("handles an already-expired session without sending its token", async () => {
  const calls = mockApi(() => undefined);
  open(recoveryLink("&expires_at=1"));
  expect((await screen.findByRole("alert")).textContent).toMatch(/expired/);
  expect(screen.queryByLabelText("New password")).toBeNull();
  expect(calls).not.toHaveBeenCalled();
});

it("requests a fresh link if the session expires while updating", async () => {
  mockApi((url) => url === "/api/auth/password" ? failure("UNAUTHENTICATED", "Session expired", 401) : undefined);
  open(recoveryLink());
  await enterPassword(userEvent.setup());
  expect((await screen.findByRole("alert")).textContent).toMatch(/invalid or expired/);
  expect(screen.queryByLabelText("New password")).toBeNull();
  expect(screen.queryByRole("heading", { name: "Password updated" })).toBeNull();
});

it("preserves update success if follow-up logout fails", async () => {
  mockApi((url) => {
    if (url === "/api/auth/password") return response(null, 204);
    if (url === "/api/auth/logout") return failure("UNAUTHENTICATED", "Session expired", 401);
  });
  open(recoveryLink());
  await enterPassword(userEvent.setup());
  expect(await screen.findByRole("heading", { name: "Password updated" })).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
});

it("handles Supabase fallback recovery redirects to the site root", async () => {
  mockApi(() => undefined);
  open(recoveryLink().replace("/auth/callback#", "/#"));
  await screen.findByLabelText("New password");
  expect(window.location.hash).toBe("");
  expect(screen.queryByText(/Signed in as/)).toBeNull();
});
