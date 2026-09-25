import React, { StrictMode } from "react";
import { expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";

const category = { id: "30000000-0000-4000-8000-000000000001", name: "Seagrass" };
const profile = { id: "current-user", display_name: "Actual Member", email: "member@example.test", status: "active", role: "user" };
const trace = (overrides = {}) => ({ id: "20000000-0000-4000-8000-000000000001", title: "Saved seagrass survey", description: "Saved description", author_id: profile.id,
  category_id: category.id, category, author: { id: profile.id, display_name: profile.display_name }, location_name: "Real coast", status: "draft", version: 1, created_at: "2026-09-22T12:00:00Z", ...overrides });
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

it("saves an unfinished draft, reopens it from contributions, and persists an edit", async () => {
  let saved;
  const calls = setup((url, options) => {
    if (url === "/api/traces" && options.method === "POST") {
      saved = trace(JSON.parse(options.body));
      return response(saved);
    }
    if (url === `/api/traces/${trace().id}` && options.method === "PUT") {
      saved = { ...saved, ...JSON.parse(options.body), version: saved.version + 1 };
      return response(saved);
    }
    if (url === `/api/contributions/${trace().id}`) return response(saved);
    if (url.startsWith("/api/contributions?")) return response(saved ? [saved] : []);
  });
  open("/user/traces/upload");
  await screen.findByRole("option", { name: "Seagrass" });
  expect(screen.getByRole("button", { name: "Save draft" }).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Category (required)"), { target: { value: category.id } });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await screen.findByRole("heading", { name: "Untitled draft" });
  const create = calls.mock.calls.find(([url, options]) => url === "/api/traces" && options.method === "POST")[1];
  expect(JSON.parse(create.body)).toEqual({ category_id: category.id, title: "", location_name: "", description: "", latitude: null, longitude: null });
  expect(create.headers.Authorization).toBe("Bearer live-access");
  fireEvent.click(screen.getByRole("link", { name: /Back to My Contributions/ }));
  fireEvent.click(await screen.findByText("Untitled draft"));
  fireEvent.click(await screen.findByRole("link", { name: "Edit draft" }));
  await screen.findByRole("option", { name: "Seagrass" });
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Return visit" } });
  fireEvent.change(screen.getByLabelText("Location"), { target: { value: "Lawis shoreline" } });
  fireEvent.change(screen.getByLabelText("Description"), { target: { value: "More seagrass observed" } });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await screen.findByRole("heading", { name: "Return visit" });
  expect(screen.getByText("More seagrass observed")).toBeTruthy();
  const writes = calls.mock.calls.filter(([, options]) => ["POST", "PUT"].includes(options.method));
  expect(writes).toHaveLength(2);
  expect(JSON.parse(writes[1][1].body)).toEqual({ category_id: category.id, title: "Return visit", location_name: "Lawis shoreline", description: "More seagrass observed", latitude: null, longitude: null, version: 1 });
});

it("preserves saved coordinates on an edit and sends the loaded version", async () => {
  const saved = trace({ version: 4, latitude: 10, longitude: 124 });
  const calls = setup((url, options) => {
    if ((url.startsWith("/api/contributions/") && !url.includes("/reviews?"))) return response(saved);
    if (options.method === "PUT") return response({ ...saved, version: 5 });
  });
  open(`/user/contributions/${saved.id}/edit`);
  await screen.findByRole("option", { name: "Seagrass" });
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Edited title" } });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await screen.findByRole("link", { name: "Edit draft" });
  const body = JSON.parse(calls.mock.calls.find(([, options]) => options.method === "PUT")[1].body);
  expect(body).toMatchObject({ version: 4, latitude: 10, longitude: 124, title: "Edited title" });
});

it("clears old coordinates when the location name changes", async () => {
  const saved = trace({ latitude: 10, longitude: 124 });
  const calls = setup((url, options) => {
    if ((url.startsWith("/api/contributions/") && !url.includes("/reviews?"))) return response(saved);
    if (options.method === "PUT") return response({ ...saved, version: 2 });
  });
  open(`/user/contributions/${saved.id}/edit`);
  await screen.findByRole("option", { name: "Seagrass" });
  fireEvent.change(screen.getByLabelText("Location"), { target: { value: "Another shore" } });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await screen.findByRole("link", { name: "Edit draft" });
  expect(JSON.parse(calls.mock.calls.find(([, options]) => options.method === "PUT")[1].body)).toMatchObject({ latitude: null, longitude: null });
});

it("keeps edits on a version conflict and requires an explicit reload", async () => {
  let saved = trace();
  const calls = setup((url, options) => {
    if ((url.startsWith("/api/contributions/") && !url.includes("/reviews?"))) return response(saved);
    if (options.method === "PUT") return failure(409);
  });
  open(`/user/contributions/${saved.id}/edit`);
  await screen.findByRole("option", { name: "Seagrass" });
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Unsaved local title" } });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  expect((await screen.findByRole("alert")).textContent).toMatch(/changed since you opened/);
  expect(screen.getByLabelText("Title").value).toBe("Unsaved local title");
  expect(screen.getByRole("button", { name: "Save draft" }).disabled).toBe(true);
  saved = trace({ version: 2, title: "Other tab title" });
  fireEvent.click(screen.getByRole("button", { name: /Discard local changes and reload/ }));
  await screen.findByDisplayValue("Other tab title");
  await waitFor(() => expect(screen.getByRole("button", { name: "Save draft" }).disabled).toBe(false));
  expect(calls.mock.calls.filter(([, options]) => options.method === "PUT")).toHaveLength(1);
});

it("blocks double saves and never automatically retries an uncertain create", async () => {
  let reject;
  const pending = new Promise((resolve, fail) => { reject = fail; });
  const calls = setup((url, options) => options.method === "POST" ? pending : undefined);
  open("/user/traces/upload");
  await screen.findByRole("option", { name: "Seagrass" });
  fireEvent.change(screen.getByLabelText("Category (required)"), { target: { value: category.id } });
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Keep this text" } });
  const button = screen.getByRole("button", { name: "Save draft" });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(screen.getByRole("button", { name: "Saving…" }).disabled).toBe(true);
  await act(async () => reject(new TypeError("connection lost")));
  expect((await screen.findByRole("alert")).textContent).toMatch(/could not confirm/);
  expect(screen.getByLabelText("Title").value).toBe("Keep this text");
  expect(screen.getByRole("button", { name: "Save draft" }).disabled).toBe(true);
  expect(calls.mock.calls.filter(([, options]) => options.method === "POST")).toHaveLength(1);
});

it.each([
  { status: "approved" }, { status: "pending" },
  { is_hidden: true }, { deleted_at: "2026-09-23" }, { author_id: "someone-else" },
])("does not offer editing for an unavailable draft: %j", async (overrides) => {
  setup((url) => (url.startsWith("/api/contributions/") && !url.includes("/reviews?")) ? response(trace(overrides)) : undefined);
  open(`/user/contributions/${trace().id}/edit`);
  expect((await screen.findByRole("alert")).textContent).toMatch(/not an editable draft/);
  expect(screen.queryByRole("button", { name: "Save draft" })).toBeNull();
});

it("handles unavailable categories without saving a mock category", async () => {
  const calls = setup((url) => url === "/api/categories" ? response([]) : undefined);
  open("/user/traces/upload");
  await screen.findByText(/No categories are available/);
  expect(screen.getByRole("button", { name: "Save draft" }).disabled).toBe(true);
  expect(calls.mock.calls.some(([, options]) => options.method === "POST")).toBe(false);
});

it("does not show a save success after logout while the write is pending", async () => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  setup((url, options) => url === "/api/traces" && options.method === "POST" ? pending : undefined);
  open("/user/traces/upload");
  await screen.findByRole("option", { name: "Seagrass" });
  fireEvent.change(screen.getByLabelText("Category (required)"), { target: { value: category.id } });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  fireEvent.click(screen.getByTitle("Profile"));
  fireEvent.click(await screen.findByRole("button", { name: /Usage & activity/ }));
  fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  await screen.findByRole("heading", { name: "Welcome to TideTrace" });
  await act(async () => finish(response(trace())));
  expect(screen.queryByText(/Draft saved\./)).toBeNull();
  expect(screen.getByRole("heading", { name: "Welcome to TideTrace" })).toBeTruthy();
});
