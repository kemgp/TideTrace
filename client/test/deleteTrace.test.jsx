import React, { StrictMode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "./router.jsx";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";

const profile = { id: "member-id", display_name: "Member", role: "user", status: "active" };
const trace = { id: "20000000-0000-4000-8000-000000000001", author_id: profile.id, title: "Coastal survey",
  description: "Observed seagrass", location_name: "Coast", category: { id: "category", name: "Seagrass" },
  status: "approved", version: 1, trace_media: [] };
const response = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const failure = (code = "FAILED", message = "Please try again.") => ({ ok: false, status: 502, json: async () => ({ error: { code, message } }) });
const endpoint = `/api/traces/${trace.id}`;

beforeEach(() => {
  // jsdom does not implement the native modal's top layer or focus handling.
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value: function () { this.open = true; } },
    close: { configurable: true, value: function () { this.open = false; } },
  });
});

function setup({ saved = trace, remove = () => ({ ok: true, status: 204 }) } = {}) {
  let deleted = false;
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "access", refresh_token: "refresh", expires_at: Date.now() / 1000 + 3600 }));
  const calls = vi.fn(async (url, options) => {
    if (url === "/api/auth/me") return response(profile);
    if ((url === endpoint && options.method === "DELETE") || url === `${endpoint}/photo-cleanup`) {
      const result = await remove(url);
      if (result.ok) deleted = true;
      return result;
    }
    if (url === endpoint || url === `/api/contributions/${trace.id}`) return response(saved);
    if (url.startsWith("/api/contributions?")) return response(deleted ? [] : [saved]);
    if (url === "/api/categories") return response([trace.category]);
    return response([]);
  });
  vi.stubGlobal("fetch", calls);
  return calls;
}

function open(path = `/user/contributions/${trace.id}`) {
  render(<StrictMode><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></StrictMode>);
}

async function dialog() {
  fireEvent.click(await screen.findByRole("button", { name: "Delete", exact: true }));
  return screen.getByRole("dialog", { name: "Delete this trace?" });
}

it.each(["draft", "pending", "revision_requested", "rejected", "approved"])("offers owner deletion for %s and shows one toast after confirmation", async (status) => {
  const calls = setup({ saved: { ...trace, status } });
  open();
  const modal = await dialog();
  expect(within(modal).getByText("This can't be undone.")).toBeTruthy();
  expect(Boolean(within(modal).queryByText("It will no longer be visible to the community."))).toBe(status === "approved");
  fireEvent.click(within(modal).getByRole("button", { name: "Delete", exact: true }));
  await screen.findByRole("heading", { name: "Your traces & their status" });
  expect(await screen.findAllByText("Trace deleted.")).toHaveLength(1);
  expect(calls.mock.calls.filter(([url, options]) => url === endpoint && options.method === "DELETE")).toHaveLength(1);
});

it("cancel and Escape send no delete request and return focus to the trigger", async () => {
  const calls = setup();
  open();
  const trigger = await screen.findByRole("button", { name: "Delete", exact: true });
  trigger.focus();
  let modal = await dialog();
  expect(document.activeElement).toBe(within(modal).getByRole("button", { name: "Cancel" }));
  fireEvent.click(within(modal).getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
  modal = await dialog();
  fireEvent(modal, new Event("cancel", { bubbles: true, cancelable: true }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(calls.mock.calls.some(([, options]) => options.method === "DELETE")).toBe(false);
});

it("disables confirmation with a spinner while deleting and keeps failures inline", async () => {
  let finish;
  const calls = setup({ remove: () => new Promise((resolve) => { finish = resolve; }) });
  open();
  const modal = await dialog();
  const confirm = within(modal).getByRole("button", { name: "Delete", exact: true });
  expect(within(modal).queryByRole("alert")).toBeNull();
  fireEvent.click(confirm);
  await waitFor(() => expect(confirm.disabled).toBe(true));
  expect(confirm.getAttribute("aria-busy")).toBe("true");
  expect(confirm.querySelector(".button-spinner")).toBeTruthy();
  fireEvent.click(confirm);
  fireEvent(modal, new Event("cancel", { bubbles: true, cancelable: true }));
  expect(screen.getByRole("dialog")).toBe(modal);
  await act(async () => finish(failure()));
  expect((await within(modal).findByRole("alert")).textContent).toBe("Please try again.");
  expect(confirm.disabled).toBe(false);
  expect(screen.queryByText("Trace deleted.")).toBeNull();
  expect(calls.mock.calls.filter(([, options]) => options.method === "DELETE")).toHaveLength(1);
});

it("retries failed photo removal without repeating deletion or a confirmation dialog", async () => {
  const calls = setup({ remove: (url) => url.endsWith("/photo-cleanup") ? { ok: true, status: 204 }
    : failure("TRACE_PHOTO_CLEANUP_FAILED", "The trace is deleted, but its photos could not be removed. Retry photo removal.") });
  open();
  const modal = await dialog();
  fireEvent.click(within(modal).getByRole("button", { name: "Delete", exact: true }));
  fireEvent.click(await within(modal).findByRole("button", { name: "Retry photo removal" }));
  await screen.findByText("Trace deleted.");
  expect(calls.mock.calls.filter(([, options]) => options.method === "DELETE")).toHaveLength(1);
  expect(calls.mock.calls.some(([url, options]) => url === `${endpoint}/photo-cleanup` && options.method === "POST")).toBe(true);
});

it("treats a 404 on the first delete as already gone and leaves with one notice", async () => {
  const calls = setup({ remove: () => ({ ok: false, status: 404, json: async () => ({ error: { code: "NOT_FOUND", message: "Record not found." } }) }) });
  open();
  const modal = await dialog();
  fireEvent.click(within(modal).getByRole("button", { name: "Delete", exact: true }));
  await screen.findByRole("heading", { name: "Your traces & their status" });
  expect(await screen.findAllByText("This trace no longer exists.")).toHaveLength(1);
  expect(screen.queryByRole("button", { name: "Retry photo removal" })).toBeNull();
  expect(calls.mock.calls.some(([url]) => url === `${endpoint}/photo-cleanup`)).toBe(false);
});

it("treats a 404 on photo-removal retry as finished", async () => {
  let first = true;
  setup({ remove: (url) => {
    if (url.endsWith("/photo-cleanup")) return { ok: false, status: 404, json: async () => ({ error: { code: "NOT_FOUND", message: "Record not found." } }) };
    if (first) { first = false; return failure("TRACE_PHOTO_CLEANUP_FAILED", "The trace is deleted, but its photos could not be removed. Retry photo removal."); }
    return { ok: true, status: 204 };
  } });
  open();
  const modal = await dialog();
  fireEvent.click(within(modal).getByRole("button", { name: "Delete", exact: true }));
  fireEvent.click(await within(modal).findByRole("button", { name: "Retry photo removal" }));
  expect(await screen.findAllByText("Trace deleted.")).toHaveLength(1);
});

it("quietly asks the server to finish pending photo removal when contributions open", async () => {
  const calls = setup();
  open("/user/contributions");
  await screen.findByRole("heading", { name: "Your traces & their status" });
  await waitFor(() => expect(calls.mock.calls.filter(([url, options]) => url === "/api/contributions/photo-cleanup" && options.method === "POST")).toHaveLength(1));
  expect(screen.queryByRole("alert")).toBeNull();
});

it("deletes from contributions without nesting the button in a link and refreshes the list", async () => {
  setup(); open("/user/contributions");
  const trigger = await screen.findByRole("button", { name: "Delete", exact: true });
  expect(trigger.closest("a")).toBeNull();
  const modal = await dialog();
  fireEvent.click(within(modal).getByRole("button", { name: "Delete", exact: true }));
  await screen.findByText("Trace deleted.");
  await screen.findByText("No saved contributions on this page.");
  expect(screen.queryByText(trace.title)).toBeNull();
});

it("offers Delete on the owner's public detail", async () => {
  setup(); open(`/user/traces/${trace.id}`);
  fireEvent.click(await screen.findByRole("button", { name: "More actions" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "Delete trace" }));
  expect(screen.getByRole("dialog", { name: "Delete this trace?" })).toBeTruthy();
});

it("does not ask to discard a selected photo after deletion was already confirmed", async () => {
  setup({ saved: { ...trace, status: "draft" } }); open();
  fireEvent.change(await screen.findByLabelText(/^Choose a photo/), {
    target: { files: [new File([new Uint8Array(12)], "coast.png", { type: "image/png" })] },
  });
  await screen.findByRole("img", { name: "Selected photo preview" });
  const modal = await dialog();
  fireEvent.click(within(modal).getByRole("button", { name: "Delete", exact: true }));
  await screen.findByRole("heading", { name: "Your traces & their status" });
  expect(screen.queryByRole("alertdialog", { name: "Unsaved changes" })).toBeNull();
  expect(await screen.findAllByText("Trace deleted.")).toHaveLength(1);
});

it("never offers Delete on someone else's detail", async () => {
  setup({ saved: { ...trace, author_id: "other-member" } }); open(`/user/traces/${trace.id}`);
  await screen.findByRole("heading", { name: trace.title });
  fireEvent.click(screen.getByRole("button", { name: "More actions" }));
  expect(screen.queryByRole("menuitem", { name: "Delete trace" })).toBeNull();
});
