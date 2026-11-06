import React, { StrictMode } from "react";
import { expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "./router.jsx";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";

const category = { id: "30000000-0000-4000-8000-000000000001", name: "Seagrass" };
const profile = { id: "current-user", display_name: "Actual Member", email: "member@example.test", status: "active", role: "moderator" };
const trace = (overrides = {}) => ({ id: "20000000-0000-4000-8000-000000000001", title: "Saved seagrass survey", description: "Saved description", author_id: "member-author",
  category_id: category.id, category, author: { id: profile.id, display_name: profile.display_name }, location_name: "Real coast", status: "pending", version: 3, created_at: "2026-09-22T12:00:00Z", ...overrides });
const response = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const failure = (status = 503) => ({ ok: false, status, json: async () => ({ error: { code: "FAILED", message: "Unable to load saved records." } }) });

function setup(handler, role = profile.role) {
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "live-access", refresh_token: "refresh", expires_at: Math.floor(Date.now() / 1000) + 3600 }));
  const calls = vi.fn(async (url, options) => {
    if (url === "/api/auth/me") return response({ ...profile, role });
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

it("keeps deleted pending Traces readable with their history and no decision or photo controls", async () => {
  const calls = setup((url) => {
    if (url === detail) return response(trace({ deleted_at: "2026-11-02T00:00:00Z", trace_media: [{ id: "deleted-photo", mime_type: "image/png" }] }));
    if (url.startsWith(`${detail}/reviews?`)) return response([{ id: "review", to_state: "revision_requested", reason: "Previous review", created_at: "2026-10-01T00:00:00Z" }]);
  });
  open(`/moderator/review/${trace().id}`);
  await screen.findByText("Deleted by the author.");
  await screen.findByText("Previous review");
  expect(screen.queryByRole("button", { name: "Approve & publish" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Hide exact location" })).toBeNull();
  expect(calls.mock.calls.some(([url]) => url.includes("/media/"))).toBe(false);
});

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
  const view = open();
  // The first Trace in the queue opens on its own beside the list.
  await screen.findByAltText("Saved seagrass survey, photo 1");
  expect(screen.getByRole("link", { name: "Saved seagrass survey" }).getAttribute("href")).toBe(`/moderator/review/${trace().id}`);
  expect(screen.queryByRole("button", { name: "Upload photo" })).toBeNull();
  fireEvent.change(screen.getByLabelText(/Feedback/), { target: { value: "Verified evidence" } });
  fireEvent.click(screen.getByRole("button", { name: "Approve & publish" }));
  await screen.findByText(/Decision saved: Approved/);
  expect(screen.getByText(/It now appears in the community archive/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Review the queue" }).getAttribute("href")).toBe("/moderator/review");
  expect(screen.queryByRole("button", { name: "Reject" })).toBeNull();
  const write = calls.mock.calls.find(([url]) => url === decisionPath)[1];
  expect(JSON.parse(write.body)).toEqual({ version: 3, decision: "approved", reason: "Verified evidence" });
  expect(write.headers.Authorization).toBe("Bearer live-access");
  await screen.findByText("No pending submissions on this page.");
  expect(screen.queryByRole("link", { name: "Moderation history" })).toBeNull();
  view.unmount();
  open("/moderator/review/history");
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
  if (decision === "rejected") {
    // Rejecting is final, so it asks for one more confirmation before anything is saved.
    await screen.findByRole("dialog", { name: "Reject this Trace?" });
    expect(calls.mock.calls.some(([url]) => url === decisionPath)).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Reject this Trace" }));
  }
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
  const calls = setup((url) => url.startsWith("/api/moderation/traces?") ? works ? response(Array.from({ length: 6 }, (_, i) => trace({ id: `row-${i}`, title: `Pending ${i}` }))) : failure() : undefined);
  open();
  await screen.findByRole("alert");
  expect(screen.queryByText("Saved seagrass survey")).toBeNull();
  works = true;
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByText("Pending 0");
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  await waitFor(() => expect(calls.mock.calls.some(([url]) => url === "/api/moderation/traces?status=pending&limit=6&offset=6")).toBe(true));
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

it("shows who made each previous Trace decision to staff", async () => {
 setup(url => {
  if (url === detail) return response(trace());
  if (url.startsWith(`${detail}/reviews?`)) return response([{ id: "review-1", actor: { id: "reviewer", display_name: "Ana Reviewer" }, to_state: "revision_requested", reason: "Add evidence", created_at: "2026-10-09T00:00:00Z" }]);
 });
 open(`/moderator/review/${trace().id}`);
 await screen.findByText(/Reviewed by Ana Reviewer/);
 expect(screen.getByText("Add evidence")).toBeTruthy();
});

it("holds a Trace for an admin and stops a moderator deciding a held Trace", async () => {
  const holdPath = `${detail}/hold`;
  const calls = setup((url) => {
    if (url === detail) return response(trace());
    if (url === holdPath) return response(trace({ version: 4 }));
  });
  open(`/moderator/review/${trace().id}`);
  fireEvent.click(await screen.findByRole("button", { name: "Hold for admin" }));
  const dialog = await screen.findByRole("dialog", { name: "Hold this Trace for an admin?" });
  expect(within(dialog).getByRole("button", { name: "Hold Trace" }).disabled).toBe(true);
  fireEvent.change(within(dialog).getByLabelText(/Why does an admin/), { target: { value: "Unsure about the pin" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Hold Trace" }));
  await screen.findByText(/On hold for an admin\./);
  expect(JSON.parse(calls.mock.calls.find(([url]) => url === holdPath)[1].body)).toEqual({ version: 3, reason: "Unsure about the pin" });
  expect(screen.getByText("This Trace is on hold. Only an admin can decide it.")).toBeTruthy();
  expect(decisionButtons().every((button) => button.disabled)).toBe(true);
});

it("shows a held Trace to an admin with a way to release it", async () => {
  window.sessionStorage.clear();
  const calls = setup((url) => url === detail ? response(trace({ hold: { reason: "Unsure about the pin", holder: { display_name: "Moderator Ana" } } })) : url === `${detail}/release-hold` ? response(trace({ version: 5 })) : undefined, "admin");
  open(`/admin/review/${trace().id}`);
  await screen.findByText(/Unsure about the pin/);
  fireEvent.click(screen.getByRole("button", { name: "Release hold" }));
  await waitFor(() => expect(screen.queryByText(/On hold for an admin\./)).toBeNull());
  expect(calls.mock.calls.some(([url, options]) => url === `${detail}/release-hold` && options.method === "POST")).toBe(true);
});

it("warns about a precise pin and shows author history before a decision", async () => {
  setup((url) => {
    if (url === detail) return response(trace({ latitude: 9.1, longitude: 123.2, is_sensitive: false }));
    if (url === "/api/moderation/authors/member-author/summary") return response({ traces: 4, approved: 3, needed_changes: 1, reports_against: 0 });
  });
  open(`/moderator/review/${trace().id}`);
  await screen.findByText(/Check the pin before approving/);
  const card = await screen.findByRole("region", { name: /About/ });
  expect(within(card).getByText("Needed changes").nextSibling.textContent).toBe("1");
});

it("fills the feedback box from a quick reason", async () => {
  setup((url) => url === detail ? response(trace()) : undefined);
  open(`/moderator/review/${trace().id}`);
  fireEvent.click(await screen.findByRole("button", { name: "Photo is unclear" }));
  expect(screen.getByLabelText(/Feedback/).value).toBe("Please add a clearer photo of what you observed.");
});

it("marks a resubmitted Trace, keeps history collapsed and lights up Approve after all quick checks", async () => {
  setup((url) => {
    if (url === detail) return response(trace({ submitted_at: "2026-10-01T00:00:00Z" }));
    if (url.startsWith(`${detail}/reviews?`)) return response([{ id: "r1", to_state: "revision_requested", reason: "Please blur the pin", actor: { display_name: "Ana" }, created_at: "2026-10-01T00:00:00Z" }]);
  });
  open(`/moderator/review/${trace().id}`);
  await screen.findByText("Resubmitted after changes");
  expect(screen.getAllByText(/Please blur the pin/).length).toBeGreaterThan(0);
  const history = screen.getByText("Review history (1)").closest("details");
  expect(history.open).toBe(false);
  const checks = screen.getAllByRole("checkbox");
  expect(checks).toHaveLength(3);
  checks.forEach((box) => fireEvent.click(box));
  await screen.findByText("All checks passed. Approve is ready.");
  expect(screen.getByRole("button", { name: "Approve & publish" }).className).toMatch(/is-ready/);
});
