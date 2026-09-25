import React, { StrictMode } from "react";
import { expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";

const category = { id: "30000000-0000-4000-8000-000000000001", name: "Seagrass" };
const profile = { id: "current-user", display_name: "Actual Member", email: "member@example.test", status: "active", role: "moderator" };
const trace = (overrides = {}) => ({ id: "20000000-0000-4000-8000-000000000001", title: "Saved seagrass survey", description: "Saved description", author_id: "member-author",
  category_id: category.id, category, author: { id: profile.id, display_name: profile.display_name }, location_name: "Real coast", status: "pending", version: 3, created_at: "2026-09-22T12:00:00Z", ...overrides });
const response = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const failure = (status = 503) => ({ ok: false, status, json: async () => ({ error: { code: "FAILED", message: "Unable to load saved records." } }) });

function setup(handler) {
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "live-access", refresh_token: "refresh", expires_at: Math.floor(Date.now() / 1000) + 3600 }));
  const calls = vi.fn(async (url, options) => {
    if (url === "/api/auth/me") return response(profile);
    const custom = await handler(url, options);
    if (custom) return custom;
    if (url === "/api/categories") return response([category]);
    return response([]);
  });
  vi.stubGlobal("fetch", calls);
  return calls;
}

function open(path = "/moderator/review") {
  return render(<StrictMode><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></StrictMode>);
}

const detail = `/api/moderation/traces/${trace().id}`;
const decisionPath = `${detail}/decision`;
const decisionButtons = () => ["Approve & publish", "Request revision", "Reject"].map((name) => screen.getByRole("button", { name }));

it("loads the live queue, reviews photos, approves and refreshes queue and history", async () => {
  let reviewed = false;
  const photo = { id: "photo-id", mime_type: "image/png", sort_order: 0 };
  const calls = setup((url, options) => {
    if (url.startsWith("/api/moderation/traces?")) return response(reviewed ? [] : [trace()]);
    if (url === detail) return response(trace({ trace_media: [photo], status: reviewed ? "approved" : "pending", version: reviewed ? 4 : 3 }));
    if (url === "/api/media/photo-id/url") return response({ url: "https://project.supabase.co/photo.png" });
    if (url === decisionPath) { reviewed = true; return response(trace({ status: "approved", version: 4 })); }
    if (url.startsWith("/api/moderation/history?")) return response([{ id: "audit", trace_id: trace().id, trace: { title: "Saved seagrass survey" }, actor: { display_name: "Actual Reviewer" }, action: "review_trace", to_state: "approved", reason: "Verified evidence", created_at: "2026-09-24T12:00:00Z" }]);
  });
  open();
  fireEvent.click(await screen.findByRole("link", { name: /Saved seagrass survey/ }));
  await screen.findByAltText("Trace photo 1");
  expect(screen.queryByRole("button", { name: "Upload photo" })).toBeNull();
  fireEvent.change(screen.getByLabelText(/Feedback/), { target: { value: "Verified evidence" } });
  fireEvent.click(screen.getByRole("button", { name: "Approve & publish" }));
  await screen.findByText(/Decision saved: Approved/);
  expect(screen.queryByRole("button", { name: "Reject" })).toBeNull();
  const write = calls.mock.calls.find(([url]) => url === decisionPath)[1];
  expect(JSON.parse(write.body)).toEqual({ version: 3, decision: "approved", reason: "Verified evidence" });
  expect(write.headers.Authorization).toBe("Bearer live-access");
  fireEvent.click(screen.getByRole("link", { name: /Back to queue/ }));
  await screen.findByText("No pending submissions on this page.");
  fireEvent.click(screen.getByRole("link", { name: "Moderation history" }));
  await screen.findByText("Verified evidence");
  expect(screen.getByText(/Actual Reviewer/)).toBeTruthy();
  fireEvent.click(screen.getByRole("link", { name: "Saved seagrass survey" }));
  await screen.findByText("This Trace is not awaiting a decision.");
});

it.each([["Request revision", "revision_requested"], ["Reject", "rejected"]])("requires feedback and persists %s using the reviewed version", async (button, decision) => {
  const calls = setup((url) => url === detail ? response(trace()) : url === decisionPath ? response(trace({ status: decision, version: 4 })) : undefined);
  open(`/moderator/review/${trace().id}`);
  fireEvent.click(await screen.findByRole("button", { name: button }));
  expect((await screen.findByRole("alert")).textContent).toMatch(/Enter feedback/);
  expect(calls.mock.calls.some(([url]) => url === decisionPath)).toBe(false);
  fireEvent.change(screen.getByLabelText(/Feedback/), { target: { value: "  Explain the location  " } });
  fireEvent.click(screen.getByRole("button", { name: button }));
  await screen.findByText(/Decision saved:/);
  expect(JSON.parse(calls.mock.calls.find(([url]) => url === decisionPath)[1].body)).toEqual({ version: 3, decision, reason: "Explain the location" });
});

it("blocks self-review and never posts a decision", async () => {
  const calls = setup((url) => url === detail ? response(trace({ author_id: profile.id })) : undefined);
  open(`/moderator/review/${trace().id}`);
  expect((await screen.findByRole("alert")).textContent).toMatch(/cannot review your own/);
  expect(screen.queryByRole("button", { name: "Approve & publish" })).toBeNull();
  expect(calls.mock.calls.some(([url]) => url === decisionPath)).toBe(false);
});

it.each([409, 502])("does not replay a conflicting or uncertain decision (%s)", async (status) => {
  let saved = trace();
  const calls = setup((url) => url === detail ? response(saved) : url === decisionPath ? failure(status) : undefined);
  open(`/moderator/review/${trace().id}`);
  fireEvent.click(await screen.findByRole("button", { name: "Approve & publish" }));
  await screen.findByRole("alert");
  expect(decisionButtons().every((button) => button.disabled)).toBe(true);
  saved = trace({ status: "approved", version: 4 });
  fireEvent.click(screen.getByRole("button", { name: "Reload Trace" }));
  await screen.findByText("This Trace is not awaiting a decision.");
  expect(calls.mock.calls.filter(([url]) => url === decisionPath)).toHaveLength(1);
});

it("prevents double decisions while a request is pending", async () => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const calls = setup((url) => url === detail ? response(trace()) : url === decisionPath ? pending : undefined);
  open(`/moderator/review/${trace().id}`);
  const approve = await screen.findByRole("button", { name: "Approve & publish" });
  fireEvent.click(approve);
  fireEvent.click(approve);
  expect(decisionButtons().every((button) => button.disabled)).toBe(true);
  await act(async () => finish(response(trace({ status: "approved", version: 4 }))));
  await screen.findByText(/Decision saved:/);
  expect(calls.mock.calls.filter(([url]) => url === decisionPath)).toHaveLength(1);
});

it("loads and paginates the queue without falling back to demo records after errors", async () => {
  let works = false;
  const calls = setup((url) => url.startsWith("/api/moderation/traces?") ? works ? response(Array.from({ length: 25 }, (_, i) => trace({ id: `row-${i}`, title: `Pending ${i}` }))) : failure() : undefined);
  open();
  await screen.findByRole("alert");
  expect(screen.queryByText("Saved seagrass survey")).toBeNull();
  works = true;
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByText("Pending 0");
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  await waitFor(() => expect(calls.mock.calls.some(([url]) => url === "/api/moderation/traces?status=pending&limit=25&offset=25")).toBe(true));
});

it("does not expose a decision UI for an unavailable direct-link record", async () => {
  setup((url) => url === detail ? failure(404) : undefined);
  open(`/moderator/review/${trace().id}`);
  expect((await screen.findByRole("alert")).textContent).toMatch(/could not be found/);
  expect(screen.queryByRole("button", { name: "Approve & publish" })).toBeNull();
});

it("discards a decision response after logout", async () => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  setup((url) => url === detail ? response(trace()) : url === decisionPath ? pending : undefined);
  open(`/moderator/review/${trace().id}`);
  fireEvent.click(await screen.findByRole("button", { name: "Approve & publish" }));
  fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  await screen.findByRole("heading", { name: "Welcome to TideTrace" });
  await act(async () => finish(response(trace({ status: "approved", version: 4 }))));
  expect(screen.queryByText(/Decision saved:/)).toBeNull();
});

it("allows an admin to open the same live review workflow", async () => {
  setup((url) => url === detail ? response(trace()) : undefined);
  const fetch = globalThis.fetch;
  vi.stubGlobal("fetch", vi.fn((url, options) => url === "/api/auth/me" ? Promise.resolve(response({ ...profile, role: "admin" })) : fetch(url, options)));
  open(`/admin/review/${trace().id}`);
  expect(await screen.findByRole("button", { name: "Approve & publish" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Moderation history" }).getAttribute("href")).toBe("/admin/review/history");
});

it("redirects members away from staff review routes", async () => {
  const calls = setup(() => undefined);
  const fetch = globalThis.fetch;
  vi.stubGlobal("fetch", vi.fn((url, options) => url === "/api/auth/me" ? Promise.resolve(response({ ...profile, role: "user" })) : fetch(url, options)));
  open(`/moderator/review/${trace().id}`);
  await screen.findByRole("link", { name: "Contributions" });
  expect(calls.mock.calls.some(([url]) => url.startsWith("/api/moderation/"))).toBe(false);
  expect(screen.queryByRole("button", { name: "Approve & publish" })).toBeNull();
});
