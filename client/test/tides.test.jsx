import React, { StrictMode } from "react";
import { expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";
import { sampleTide } from "../src/data/sampleTide.js";

const id = "50000000-0000-4000-8000-000000000001";
const stamp = "2026-09-25T00:00:00.000Z";
const lesson = (extra = {}) => ({ ...sampleTide, id, status: "draft", updated_at: stamp, ...extra });
const detail = `/api/admin/tides/${id}`;
const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const fail = (status = 503, code = "FAILED") => ({ ok: false, status, json: async () => ({ error: { code, message: "Unable to load lesson." } }) });
function setup(handler = () => undefined, role = "admin") {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "live-access", refresh_token: "refresh", expires_at: Date.now() / 1000 + 3600 }));
  const calls = vi.fn(async (url, options) => {
    if (url === "/api/auth/me") return ok({ id: "current-user", display_name: "Test Member", email: "member@example.test", status: "active", role });
    return await handler(url, options) || ok([]);
  });
  vi.stubGlobal("fetch", calls);
  return calls;
}
const open = (path) => render(<StrictMode><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></StrictMode>);
async function clickReady(name) {
  const button = await screen.findByRole("button", { name, exact: true });
  await waitFor(() => expect(button.closest("fieldset")?.disabled || button.disabled).toBe(false));
  fireEvent.click(button);
}

it("creates the sample draft, previews safely, publishes, returns to draft and archives the same lesson", async () => {
  let saved;
  let version = 0;
  const calls = setup((url, options) => {
    if (url === "/api/admin/tides" && options.method === "POST" || url === detail && options.method === "PUT") {
      const { updated_at, ...body } = JSON.parse(options.body);
      saved = lesson({ ...body, updated_at: `2026-09-25T00:00:0${++version}.000Z` });
      return ok(saved);
    }
    if (url === detail) return ok(saved);
    if (url.startsWith("/api/admin/tides?")) return ok(saved ? [saved] : []);
  });
  open("/admin/tides/new");
  fireEvent.click(await screen.findByRole("button", { name: "Use sample lesson" }));
  expect(screen.getByLabelText("Lesson title").value).toBe(sampleTide.title);
  await clickReady("Preview");
  expect(within(screen.getByRole("region", { name: "Lesson preview" })).getByRole("heading", { name: sampleTide.title })).toBeTruthy();
  expect(calls.mock.calls.some(([, options]) => options.method === "POST")).toBe(false);
  await clickReady("Save draft");
  await screen.findByRole("heading", { name: "Edit lesson" });
  await clickReady("Publish");
  await screen.findByRole("button", { name: "Save published changes" });
  await clickReady("Return to draft");
  await screen.findByRole("button", { name: "Save draft" });
  await clickReady("Archive");
  await screen.findByRole("button", { name: "Save archived changes" });
  fireEvent.click(screen.getByRole("link", { name: /Back to Manage Tides/ }));
  fireEvent.click(await screen.findByRole("link", { name: sampleTide.title }));
  await screen.findByRole("button", { name: "Save archived changes" });
  const writes = calls.mock.calls.filter(([, options]) => ["POST", "PUT"].includes(options.method));
  expect(writes.map(([, options]) => JSON.parse(options.body).status)).toEqual(["draft", "published", "draft", "archived"]);
  expect(writes.filter(([, options]) => options.method === "POST")).toHaveLength(1);
  expect(JSON.parse(writes[1][1].body).updated_at).toBe("2026-09-25T00:00:01.000Z");
});

it("validates fields inline, suggests a slug and requires content to publish", async () => {
  const calls = setup();
  open("/admin/tides/new");
  await clickReady("Publish");
  expect(screen.getAllByRole("alert")).toHaveLength(3);
  fireEvent.change(screen.getByLabelText("Lesson title"), { target: { value: "Useful Coastal Observations!" } });
  expect(screen.getByLabelText("Slug").value).toBe("useful-coastal-observations");
  fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "custom-slug" } });
  fireEvent.change(screen.getByLabelText("Lesson title"), { target: { value: "Changed title" } });
  expect(screen.getByLabelText("Slug").value).toBe("custom-slug");
  await clickReady("Publish");
  expect(screen.getByRole("alert").textContent).toMatch(/Add lesson content/);
  expect(calls.mock.calls.some(([, options]) => options.method === "POST")).toBe(false);
});

it("allows a draft with empty content and displays duplicate slug errors inline", async () => {
  const calls = setup((url) => url === "/api/admin/tides" ? fail(409, "ALREADY_EXISTS") : undefined);
  open("/admin/tides/new");
  fireEvent.change(await screen.findByLabelText("Lesson title"), { target: { value: "Coast" } });
  await clickReady("Save draft");
  await screen.findByText("This slug is already used. Choose a different one.");
  expect(screen.getByLabelText("Slug").getAttribute("aria-invalid")).toBe("true");
  expect(JSON.parse(calls.mock.calls.find(([, options]) => options.method === "POST")[1].body).body).toBe("");
});

it("previews untrusted HTML as text without executing markup", async () => {
  setup(); open("/admin/tides/new");
  fireEvent.change(await screen.findByLabelText("Lesson content"), { target: { value: '<img src=x onerror="alert(1)">\nSecond paragraph' } });
  await clickReady("Preview");
  const region = screen.getByRole("region", { name: "Lesson preview" });
  expect(region.textContent).toContain('<img src=x onerror="alert(1)">');
  expect(region.querySelector("img")).toBeNull();
});

it.each([409, 502])("blocks replay after uncertain or stale update %s and reloads saved state", async (status) => {
  let saved = lesson();
  const calls = setup((url, options) => url === detail ? options.method === "PUT" ? fail(status, "STALE_VERSION") : ok(saved) : undefined);
  open(`/admin/tides/${id}/edit`);
  await clickReady("Publish");
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Lesson title").closest("fieldset").disabled).toBe(true);
  saved = lesson({ status: "published", updated_at: "2026-09-25T00:00:01Z" });
  await clickReady("Discard local changes and reload saved lesson");
  await screen.findByRole("button", { name: "Save published changes" });
  expect(calls.mock.calls.filter(([, options]) => options.method === "PUT")).toHaveLength(1);
});

it("does not recreate automatically after a lost create response", async () => {
  const calls = setup((url) => { if (url === "/api/admin/tides") throw new TypeError("Lost response"); });
  open("/admin/tides/new");
  fireEvent.click(await screen.findByRole("button", { name: "Use sample lesson" }));
  await clickReady("Save draft");
  await screen.findByText(/Check Manage Tides for the saved lesson/);
  expect(screen.getByLabelText("Lesson title").closest("fieldset").disabled).toBe(true);
  expect(calls.mock.calls.filter(([, options]) => options.method === "POST")).toHaveLength(1);
});

it("blocks duplicate save actions and ignores their response after logout", async () => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const calls = setup((url) => url === "/api/admin/tides" ? pending : undefined);
  open("/admin/tides/new");
  fireEvent.click(await screen.findByRole("button", { name: "Use sample lesson" }));
  const save = screen.getByRole("button", { name: "Save draft" });
  fireEvent.click(save); fireEvent.click(save);
  await waitFor(() => expect(calls.mock.calls.filter(([, options]) => options.method === "POST")).toHaveLength(1));
  expect(save.closest("fieldset").disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  await screen.findByRole("heading", { name: "Welcome to TideTrace" });
  await act(async () => finish(ok(lesson())));
  expect(screen.queryByRole("heading", { name: "Edit lesson" })).toBeNull();
});

it("loads the published library, opens a lesson and supports direct detail URLs without mock progress", async () => {
  const calls = setup((url) => url.startsWith("/api/tides?") ? ok([lesson({ status: "published" })]) : url === `/api/tides/${id}` ? ok(lesson({ status: "published" })) : undefined, "user");
  const view = open("/user/tides");
  fireEvent.click(await screen.findByRole("link", { name: new RegExp(sampleTide.title) }));
  await screen.findByRole("heading", { name: sampleTide.title });
  expect(screen.getByRole("article", { name: "Lesson content" }).textContent).toContain("Every observation starts");
  expect(screen.queryByRole("button", { name: "Mark as complete" })).toBeNull();
  view.unmount();
  open(`/user/tides/${id}`);
  await screen.findByRole("heading", { name: sampleTide.title });
  expect(calls.mock.calls.some(([url]) => url === `/api/tides/${id}`)).toBe(true);
});

it.each(["draft", "archived"])("does not render inaccessible %s lesson content", async (status) => {
  setup((url) => url === `/api/tides/${id}` ? fail(404) : undefined, "user");
  open(`/user/tides/${id}`);
  await screen.findByText("This record could not be found.");
  expect(screen.queryByRole("article", { name: "Lesson content" })).toBeNull();
});

it("handles empty lists, retries errors and paginates published lessons", async () => {
  let works = false;
  const calls = setup((url) => {
    if (url.startsWith("/api/tides?")) return works ? ok(url.endsWith("offset=25") ? [] : Array.from({ length: 25 }, (_, i) => lesson({ id: `lesson-${i}`, title: `Lesson ${i}`, status: "published" }))) : fail();
  }, "user");
  open("/user/tides");
  await screen.findByRole("alert");
  works = true; fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByRole("link", { name: /Lesson 0/ });
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  await screen.findByText("No published lessons found.");
  expect(calls.mock.calls.some(([url]) => url === "/api/tides?limit=25&offset=25")).toBe(true);
});

it("does not request admin lessons for a member visiting the editor", async () => {
  const calls = setup(() => undefined, "user");
  open(`/admin/tides/${id}/edit`);
  await screen.findByText(/Kumusta/);
  expect(calls.mock.calls.some(([url]) => url.startsWith("/api/admin/tides"))).toBe(false);
  expect(screen.queryByLabelText("Lesson content")).toBeNull();
});
