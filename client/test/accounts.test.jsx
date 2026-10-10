import React, { StrictMode } from "react";
import { expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";
const id = "10000000-0000-4000-8000-000000000002";
const account = (extra = {}) => ({ id, display_name: "Actual Member", role: "user", status: "active", updated_at: "2026-10-01T00:00:00Z", ...extra });
const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const fail = (status) => ({ ok: false, status, json: async () => ({ error: { code: status === 409 ? "STALE_VERSION" : "FAILED", message: "Account changed" } }) });
function setup(handler = () => undefined, role = "admin") {
 sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "live-access", refresh_token: "refresh", expires_at: Date.now()/1000+3600 }));
 const calls = vi.fn(async (url, options) => {
  if (url === "/api/auth/me") return ok({ id: "admin-id", display_name: "Admin", role, status: "active" });
  const custom = await handler(url, options); if (custom) return custom;
  if (url.startsWith("/api/admin/users?")) return ok([account()]);
  if (url === `/api/admin/users/${id}`) return ok(account());
  return ok([]);
 });
 vi.stubGlobal("fetch", calls); return calls;
}
const open = (path = "/admin/users") => render(<StrictMode><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></StrictMode>);
const writes = (calls) => calls.mock.calls.filter(([, options]) => options.method === "PATCH");
async function edit(button = "Manage account") {
 fireEvent.click(await screen.findByRole("button", { name: button }));
 await screen.findByLabelText("Account role");
}
it("promotes an existing member, verifies the saved account, and refreshes the list", async () => {
 let saved = account();
 const calls = setup((url, options) => {
  if (url.startsWith("/api/admin/users?")) return ok([saved]);
  if (url === `/api/admin/users/${id}`) {
   if (options.method === "PATCH") { saved = { ...saved, ...JSON.parse(options.body), updated_at: "2026-10-01T01:00:00Z" }; return { ok: true, status: 204 }; }
   return ok(saved);
  }
 });
 open("/admin/moderators?add=1"); await edit("Assign moderator");
 expect(screen.getByLabelText("Account role").value).toBe("moderator");
 fireEvent.click(screen.getByRole("button", { name: "Save account changes" }));
 await screen.findByText("Enter a reason for this account change.");
 expect(writes(calls)).toHaveLength(0);
 fireEvent.change(screen.getByLabelText("Reason for change"), { target: { value: "Assigned reviewer" } });
 fireEvent.click(screen.getByRole("button", { name: "Save account changes" }));
 await screen.findByText("Account changes saved.");
 expect(saved.role).toBe("moderator");
 expect(JSON.parse(writes(calls)[0][1].body)).toEqual({ role: "moderator", status: "active", reason: "Assigned reviewer", updated_at: "2026-10-01T00:00:00Z" });
});
it.each([["user", "active"], ["moderator", "suspended"], ["moderator", "active"]])("saves role %s status %s without deleting the account", async (role, status) => {
 let saved = account({ role: "moderator", status: status === "active" && role === "moderator" ? "suspended" : "active" });
 const calls = setup((url, options) => {
  if (url.startsWith("/api/admin/users?")) return ok([saved]);
  if (url === `/api/admin/users/${id}`) {
   if (options.method === "PATCH") { saved = { ...saved, ...JSON.parse(options.body) }; return { ok: true, status: 204 }; }
   return ok(saved);
  }
 });
 open("/admin/moderators"); await edit();
 fireEvent.change(screen.getByLabelText("Account role"), { target: { value: role } });
 fireEvent.change(screen.getByLabelText("Access status"), { target: { value: status } });
 fireEvent.change(screen.getByLabelText("Reason for change"), { target: { value: "Access review" } });
 fireEvent.click(screen.getByRole("button", { name: "Save account changes" }));
 await screen.findByText("Account changes saved.");
 expect(saved).toMatchObject({ id, role, status });
 expect(calls.mock.calls.some(([, options]) => options.method === "DELETE")).toBe(false);
});
it.each([409, 503])("blocks stale/uncertain saves (%s) and reloads instead of replaying", async (status) => {
 let saved = account();
 const calls = setup((url, options) => url === `/api/admin/users/${id}` ? options.method === "PATCH" ? fail(status) : ok(saved) : undefined);
 open(); await edit();
 fireEvent.change(screen.getByLabelText("Access status"), { target: { value: "suspended" } });
 fireEvent.change(screen.getByLabelText("Reason for change"), { target: { value: "Review" } });
 fireEvent.click(screen.getByRole("button", { name: "Save account changes" }));
 await screen.findByRole("button", { name: "Reload saved account" });
 expect(screen.getByLabelText("Account role").closest("fieldset").disabled).toBe(true);
 saved = account({ status: "suspended", updated_at: "2026-10-01T01:00:00Z" });
 fireEvent.click(screen.getByRole("button", { name: "Reload saved account" }));
 await waitFor(() => expect(screen.getByLabelText("Access status").value).toBe("suspended"));
 expect(writes(calls)).toHaveLength(1);
});
it("searches and filters the entire account list through the API and paginates", async () => {
 const calls = setup((url) => url.startsWith("/api/admin/users?") ? ok(url.includes("offset=6") ? [] : Array.from({length:6},(_,i)=>account({ id: `${id}-${i}` }))) : undefined);
 open(); await screen.findAllByText("Actual Member");
 fireEvent.change(screen.getByLabelText("Search by name or account ID"), { target: { value: "Reef" } });
 fireEvent.click(screen.getByRole("button", { name: "Search accounts" }));
 await waitFor(() => expect(calls.mock.calls.some(([url]) => url.includes("q=Reef"))).toBe(true));
 fireEvent.change(screen.getByLabelText("Role"), { target: { value: "moderator" } });
 await screen.findAllByText("Actual Member");
 fireEvent.click(screen.getByRole("button", { name: "Next page" }));
 await screen.findByText("No accounts match these filters.");
 expect(calls.mock.calls.some(([url]) => url.includes("offset=6") && url.includes("role=moderator") && url.includes("q=Reef"))).toBe(true);
});
it("shows six accounts per page and reaches the remaining accounts without overlap", async () => {
 const all = Array.from({ length: 9 }, (_, i) => account({ id: `${id}-${i}`, display_name: `Member ${i + 1}` }));
 const calls = setup((url) => {
  if (!url.startsWith("/api/admin/users?")) return;
  const params = new URL(url, "http://localhost").searchParams;
  const offset = Number(params.get("offset"));
  return ok(all.slice(offset, offset + Number(params.get("limit"))));
 });
 open();
 await screen.findByText("Member 1");
 expect(screen.getAllByRole("button", { name: "Manage account" })).toHaveLength(6);
 expect(screen.queryByText("Member 7")).toBeNull();
 fireEvent.click(screen.getByRole("button", { name: "Next page" }));
 await screen.findByText("Member 7");
 expect(screen.getAllByRole("button", { name: "Manage account" })).toHaveLength(3);
 expect(screen.queryByText("Member 1")).toBeNull();
 expect(screen.getByRole("button", { name: "Next page" }).disabled).toBe(true);
 expect(screen.getByText("Page 2")).toBeTruthy();
 expect(calls.mock.calls.some(([url]) => url.includes("limit=6&offset=6"))).toBe(true);
 fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
 await screen.findByText("Member 1");
 expect(screen.getAllByRole("button", { name: "Manage account" })).toHaveLength(6);
});
it("shows persisted audit reasons and disables changing the current admin", async () => {
 setup((url) => {
  if (url.startsWith("/api/admin/users?")) return ok([account({ id: "admin-id", role: "admin" })]);
  if (url === "/api/admin/users/admin-id") return ok(account({ id: "admin-id", role: "admin" }));
  if (url.startsWith("/api/admin/audit-logs?")) return ok([{ id: "audit", actor: { display_name: "Other Admin" }, created_at: "2026-10-01T00:00:00Z", old_values: { role: "user", status: "active" }, new_values: { role: "admin", status: "active" }, reason: "Appointed administrator" }]);
 });
 open(); await edit();
 expect(screen.getByLabelText("Account role").closest("fieldset").disabled).toBe(true);
 const history = screen.getByRole("region", { name: "Account change history" });
 await within(history).findByText("Appointed administrator");
});
it("prevents duplicate saves and ignores late responses after logout", async () => {
 let finish;
 const pending = new Promise((resolve) => { finish = resolve; });
 const calls = setup((url, options) => options.method === "PATCH" ? pending : undefined);
 open(); await edit();
 fireEvent.change(screen.getByLabelText("Access status"), { target: { value: "suspended" } });
 fireEvent.change(screen.getByLabelText("Reason for change"), { target: { value: "Review" } });
 const save = screen.getByRole("button", { name: "Save account changes" }); fireEvent.click(save); fireEvent.click(save);
 await waitFor(() => expect(writes(calls)).toHaveLength(1));
 fireEvent.click(screen.getByRole("button", { name: "Log out" }));
 await screen.findByRole("heading", { name: "Welcome to TideTrace" });
 await act(async () => finish({ ok: true, status: 204 }));
 expect(screen.queryByText("Account changes saved.")).toBeNull();
});
it.each(["user", "moderator"])("does not load account data for a %s", async (role) => {
 const calls = setup(() => undefined, role); open();
 await screen.findByText(role === "user" ? /Kumusta/ : /Magandang/);
 expect(screen.queryByRole("heading", { name: "Community accounts" })).toBeNull();
 expect(calls.mock.calls.some(([url]) => url.startsWith("/api/admin/users"))).toBe(false);
});

it("does not offer admin assignment for members or moderators", async () => {
 setup(); open(); await edit();
 expect(within(screen.getByLabelText("Account role")).queryByRole("option", { name: /Admin/ })).toBeNull();
});
