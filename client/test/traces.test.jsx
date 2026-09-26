import React, { StrictMode } from "react";
import { expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";

const category = { id: "30000000-0000-4000-8000-000000000001", name: "Seagrass" };
const profile = { id: "current-user", display_name: "Actual Member", email: "member@example.test", status: "active", role: "user" };
const trace = (overrides = {}) => ({ id: "20000000-0000-4000-8000-000000000001", title: "Saved seagrass survey", description: "Saved description", author_id: profile.id,
  category_id: category.id, category, author: { id: profile.id, display_name: profile.display_name }, location_name: "Real coast", status: "approved", created_at: "2026-09-22T12:00:00Z", ...overrides });
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

function open(path = "/user/traces") {
  return render(<StrictMode><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></StrictMode>);
}

it("loads live categories and approved records, then opens the saved detail", async () => {
  const calls = setup((url) => {
    if (url.startsWith("/api/traces?")) return response([trace()]);
    if (url === `/api/traces/${trace().id}`) return response(trace());
  });
  open();
  expect(await screen.findByRole("button", { name: "Seagrass" })).toBeTruthy();
  fireEvent.click(await screen.findByText("Saved seagrass survey"));
  expect(await screen.findByText("Saved description")).toBeTruthy();
  expect(screen.getByText("Actual Member")).toBeTruthy();
  expect(calls.mock.calls.filter(([url]) => !url.includes("/auth/")).every(([, options]) => options.headers.Authorization === "Bearer live-access")).toBe(true);
});

it("shows media before the title and saves comments through the trace API", async () => {
  const comments = [];
  const calls = setup((url, options) => {
    if (url === `/api/traces/${trace().id}`) return response(trace());
    if (url.startsWith(`/api/traces/${trace().id}/comments`)) {
      if (options.method === "POST") {
        const saved = { id: "comment-1", trace_id: trace().id, author_id: profile.id, body: JSON.parse(options.body).body, created_at: "2026-09-26T12:00:00Z" };
        comments.push(saved);
        return response(saved);
      }
      return response([...comments]);
    }
  });
  open(`/user/traces/${trace().id}`);
  const title = await screen.findByRole("heading", { name: trace().title });
  expect(screen.getByRole("region", { name: "Trace photos" }).compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  await screen.findByText(/No comments yet/);
  fireEvent.change(screen.getByRole("textbox", { name: "Add a comment" }), { target: { value: "I observed this too." } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  expect(await screen.findByText("I observed this too.")).toBeTruthy();
  expect(screen.getByText("Comments (1)")).toBeTruthy();
  expect(screen.getByRole("textbox", { name: "Add a comment" }).value).toBe("");
  expect(calls.mock.calls.filter(([, options]) => options.method === "POST")).toHaveLength(1);
});

it("keeps an unconfirmed comment and prevents accidental duplicate sends", async () => {
  setup((url, options) => {
    if (url === `/api/traces/${trace().id}`) return response(trace());
    if (url.includes("/comments") && options.method === "POST") throw new TypeError("Connection lost");
  });
  open(`/user/traces/${trace().id}`);
  const input = await screen.findByRole("textbox", { name: "Add a comment" });
  fireEvent.change(input, { target: { value: "Keep this comment" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  expect((await screen.findByRole("alert")).textContent).toContain("could not confirm");
  expect(input.value).toBe("Keep this comment");
  expect(screen.getByRole("button", { name: "Send" }).disabled).toBe(true);
});

it("shows a real loading state and an empty archive without sample records", async () => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  setup((url) => url.startsWith("/api/traces?") ? pending : undefined);
  open();
  await screen.findByRole("heading", { name: "Community archive" });
  expect(screen.getAllByText("Loading…").length).toBeGreaterThan(0);
  expect(screen.queryByText("No approved traces found.")).toBeNull();
  await act(async () => finish(response([])));
  expect(await screen.findByText("No approved traces found.")).toBeTruthy();
  expect(screen.queryByText(/40 new mangrove seedlings/)).toBeNull();
});

it("retries failed list requests instead of substituting demo data", async () => {
  let works = false;
  setup((url) => url.startsWith("/api/traces?") ? works ? response([trace()]) : failure() : undefined);
  open();
  expect((await screen.findByRole("alert")).textContent).toMatch(/Unable to load/);
  works = true;
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("Saved seagrass survey")).toBeTruthy();
});

it("paginates the server feed and resets the page when selecting a category", async () => {
  const calls = setup((url) => url.startsWith("/api/traces?") ? response(Array.from({ length: 25 }, (_, i) => trace({ id: String(i), title: `Saved record ${i}` }))) : undefined);
  open();
  await screen.findByText("Saved record 0");
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  await waitFor(() => expect(calls.mock.calls.some(([url]) => url === "/api/traces?limit=25&offset=25")).toBe(true));
  fireEvent.click(screen.getByRole("button", { name: "Seagrass" }));
  await waitFor(() => expect(calls.mock.calls.some(([url]) => url === `/api/traces?limit=25&offset=0&category_id=${category.id}`)).toBe(true));
});

it("loads the current account's contributions including drafts and revision requests", async () => {
  const calls = setup((url) => url.startsWith("/api/contributions?") ? response([trace({ status: "draft", title: "My saved draft" }), trace({ id: "revision-id", status: "revision_requested", title: "My revision" })]) : undefined);
  open("/user/contributions");
  expect(await screen.findByText("My saved draft")).toBeTruthy();
  expect(screen.getByText("My revision")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Needs revision" }));
  expect(screen.queryByText("My saved draft")).toBeNull();
  expect(screen.getByText("My revision")).toBeTruthy();
  expect(calls.mock.calls.some(([url]) => url === "/api/contributions?limit=25&offset=0")).toBe(true);
});

it("restores a contribution detail directly using the owner-scoped endpoint", async () => {
  const calls = setup((url) => url === `/api/contributions/${trace().id}` ? response(trace({ status: "revision_requested" })) : undefined);
  open(`/user/contributions/${trace().id}`);
  expect(await screen.findByText("Saved description")).toBeTruthy();
  expect(screen.getByText("Needs revision")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Edit.*resubmit/ })).toBeNull();
  expect(calls.mock.calls.some(([url]) => url === `/api/traces/${trace().id}`)).toBe(false);
});

it("handles inaccessible contribution details without showing a mock submission", async () => {
  setup((url) => (url.startsWith("/api/contributions/") && !url.includes("/reviews?")) ? failure(404) : undefined);
  open(`/user/contributions/${trace().id}`);
  expect((await screen.findByRole("alert")).textContent).toMatch(/could not be found/);
  expect(screen.queryByText("Saved description")).toBeNull();
});

it("ignores a late response after switching category filters", async () => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  setup((url) => {
    if (url.includes("category_id=")) return response([trace({ title: "Filtered record" })]);
    if (url.startsWith("/api/traces?")) return pending;
  });
  open();
  fireEvent.click(await screen.findByRole("button", { name: "Seagrass" }));
  expect(await screen.findByText("Filtered record")).toBeTruthy();
  await act(async () => finish(response([trace({ title: "Stale record" })])));
  expect(screen.queryByText("Stale record")).toBeNull();
  expect(screen.getByText("Filtered record")).toBeTruthy();
});

it("handles malformed collection responses as retryable errors", async () => {
  setup((url) => url.startsWith("/api/traces?") ? response({ unexpected: true }) : undefined);
  open();
  expect((await screen.findByRole("alert")).textContent).toMatch(/unexpected response/);
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  expect(screen.queryByText("No approved traces found.")).toBeNull();
});

it("keeps the archive usable when categories fail and can retry categories separately", async () => {
  let works = false;
  setup((url) => {
    if (url === "/api/categories") return works ? response([category]) : failure();
    if (url.startsWith("/api/traces?")) return response([trace()]);
  });
  open();
  await screen.findByRole("alert");
  expect(await screen.findByText("Saved seagrass survey")).toBeTruthy();
  works = true;
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("button", { name: "Seagrass" })).toBeTruthy();
});

it("searches displayed records by author and location without showing unrelated matches", async () => {
  setup((url) => url.startsWith("/api/traces?") ? response([trace(), trace({ id: "other", title: "Another survey", location_name: "Other coast", author: { display_name: "Other Member" } })]) : undefined);
  open();
  await screen.findByText("Saved seagrass survey");
  fireEvent.change(screen.getByPlaceholderText(/Search this page/), { target: { value: "Actual Member" } });
  expect(screen.getByText("Saved seagrass survey")).toBeTruthy();
  expect(screen.queryByText("Another survey")).toBeNull();
  fireEvent.change(screen.getByPlaceholderText(/Search this page/), { target: { value: "other coast" } });
  expect(screen.getByText("Another survey")).toBeTruthy();
  expect(screen.queryByText("Saved seagrass survey")).toBeNull();
});

it("discards a private read that finishes after logout", async () => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  setup((url) => url.startsWith("/api/contributions?") ? pending : undefined);
  open("/user/contributions");
  await screen.findByRole("heading", { name: "Your traces & their status" });
  fireEvent.click(screen.getByTitle("Profile"));
  fireEvent.click(await screen.findByRole("button", { name: /Usage & activity/ }));
  fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  await screen.findByRole("heading", { name: "Welcome to TideTrace" });
  await act(async () => finish(response([trace({ title: "Private late response" })])));
  expect(screen.queryByText("Private late response")).toBeNull();
  expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull();
});
