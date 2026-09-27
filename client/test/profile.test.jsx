import React, { StrictMode } from "react";
import { expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";

const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const failure = (status = 400) => ({ ok: false, status, json: async () => ({ error: { code: "FAILED", message: "Profile save failed." } }) });
function setup(role = "admin", handler = () => undefined) {
  const account = { id: "owner-id", display_name: "Original Name", email: "member@example.test", role, status: "active" };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "live-access", refresh_token: "refresh", expires_at: Date.now() / 1000 + 3600 }));
  const calls = vi.fn(async (url, options) => {
    const result = await handler(url, options, account);
    if (result) return result;
    if (url === "/api/auth/me") return ok({ ...account });
    if (url === "/api/profile" && options.method === "PATCH") { account.display_name = JSON.parse(options.body).display_name; return ok({ id: account.id, display_name: account.display_name }); }
    return ok([]);
  });
  vi.stubGlobal("fetch", calls);
  return { calls, account };
}
const open = (path) => render(<StrictMode><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></StrictMode>);
async function openForm(role) {
  const view = open(`/${role === "moderator" ? "moderator" : role}/profile`);
  if (role !== "user") fireEvent.click(await screen.findByRole("button", { name: /Basic information/ }));
  await screen.findByLabelText("Full name");
  return view;
}

it.each(["user", "moderator", "admin"])("persists the %s display name and reloads the saved profile", async (role) => {
  const { calls } = setup(role);
  const view = await openForm(role);
  expect(screen.getByLabelText("Email address").readOnly).toBe(true);
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "  Updated Name  " } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByText("Display name saved.");
  await waitFor(() => expect(screen.getByText(/Signed in as Updated Name/)).toBeTruthy());
  const writes = calls.mock.calls.filter(([url]) => url === "/api/profile");
  expect(writes).toHaveLength(1);
  expect(JSON.parse(writes[0][1].body)).toEqual({ display_name: "Updated Name" });
  expect(writes[0][1].headers.Authorization).toBe("Bearer live-access");
  view.unmount();
  await openForm(role);
  expect(screen.getByLabelText("Full name").value).toBe("Updated Name");
});

it("rejects an empty name without writing and never reports success after a rejected save", async () => {
  const { calls } = setup("admin", (url) => url === "/api/profile" ? failure() : undefined);
  await openForm("admin");
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: " " } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByText("Enter a name between 1 and 100 characters.");
  expect(calls.mock.calls.some(([url]) => url === "/api/profile")).toBe(false);
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "New Name" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByText("Profile save failed.");
  expect(screen.queryByText("Display name saved.")).toBeNull();
  expect(screen.getByLabelText("Full name").value).toBe("New Name");
});

it("checks an uncertain save by reloading instead of replaying it", async () => {
  const { calls } = setup("moderator", (url, options, account) => {
    if (url === "/api/profile") { account.display_name = JSON.parse(options.body).display_name; throw new TypeError("Lost response"); }
  });
  await openForm("moderator");
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Saved Despite Timeout" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByText(/We could not confirm the save/);
  expect(screen.getByLabelText("Full name").closest("fieldset").disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Reload saved profile" }));
  await screen.findByText("Saved profile reloaded.");
  expect(screen.getByLabelText("Full name").value).toBe("Saved Despite Timeout");
  expect(calls.mock.calls.filter(([url]) => url === "/api/profile")).toHaveLength(1);
});

it("prevents duplicate saves and discards success after logout", async () => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const { calls } = setup("admin", (url) => url === "/api/profile" ? pending : undefined);
  await openForm("admin");
  const button = screen.getByRole("button", { name: "Save changes" });
  fireEvent.click(button); fireEvent.click(button);
  await waitFor(() => expect(calls.mock.calls.filter(([url]) => url === "/api/profile")).toHaveLength(1));
  expect(button.closest("fieldset").disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  await screen.findByRole("heading", { name: "Welcome to TideTrace" });
  await act(async () => finish(ok({ id: "owner-id", display_name: "Original Name" })));
  expect(screen.queryByText("Display name saved.")).toBeNull();
});

it.each(["user", "moderator", "admin"])("routes %s password changes through the real recovery flow", async (role) => {
  const { calls } = setup(role);
  await openForm(role);
  fireEvent.click(screen.getByRole("button", { name: /Security/ }));
  const link = await screen.findByRole("link", { name: "Reset password" });
  expect(link.getAttribute("href")).toBe("/forgot-password");
  expect(screen.queryByPlaceholderText("Enter current password")).toBeNull();
  fireEvent.click(link);
  await screen.findByRole("heading", { name: "Password recovery" });
  expect(calls.mock.calls.some(([url]) => url === "/api/auth/password")).toBe(false);
});

it.each(["admin", "moderator"])("prevents a member from opening the %s profile route", async (role) => {
  setup("user"); open(`/${role}/profile`);
  await screen.findByText(/Kumusta/);
  expect(screen.queryByRole("button", { name: /Basic information/ })).toBeNull();
});

it("disables unsupported staff profile photos and preferences", async () => {
  setup("moderator"); open("/moderator/profile");
  await screen.findByText("Profile photo uploads are not available yet.");
  expect(screen.getByLabelText("Profile photo upload unavailable").disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: /Preferences/ }));
  await screen.findByText(/Email notification preferences are not available yet/);
  expect(screen.queryByRole("button", { name: "Save Changes" })).toBeNull();
});
