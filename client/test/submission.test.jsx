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

const photo = { id: "40000000-0000-4000-8000-000000000001", trace_id: trace().id, mime_type: "image/png", sort_order: 0 };
const complete = (overrides = {}) => trace({ trace_media: [photo], ...overrides });
const detail = `/api/contributions/${trace().id}`;
const submit = `/api/traces/${trace().id}/submit`;
function submissionSetup(handler) {
  return setup((url, options) => {
    const result = handler(url, options);
    if (result) return result;
    if (url.endsWith("/url")) return response({ url: "https://project.supabase.co/photo.png" });
  });
}
async function ready() {
  const button = await screen.findByRole("button", { name: "Submit for review" });
  await waitFor(() => expect(button.disabled).toBe(false));
  return button;
}

it("submits the latest version and displays Pending with editing and upload controls removed", async () => {
  let saved = complete();
  let reads = 0;
  const calls = submissionSetup((url, options) => {
    if (url === detail) return response({ ...saved, version: ++reads >= 2 ? 5 : 1 });
    if (url === submit) { saved = complete({ status: "pending", version: 6 }); return response(saved); }
  });
  open(`/user/contributions/${trace().id}`);
  fireEvent.click(await ready());
  await screen.findByText(/Your Trace is awaiting a reviewer/);
  expect(screen.getByText("Pending review")).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Edit draft" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Upload photo" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Remove photo 1" })).toBeNull();
  const writes = calls.mock.calls.filter(([url]) => url === submit);
  expect(writes).toHaveLength(1);
  expect(JSON.parse(writes[0][1].body)).toEqual({ version: 5 });
  expect(writes[0][1].headers.Authorization).toBe("Bearer live-access");
});

it.each([
  [{ title: " " }, "Enter a title."],
  [{ description: "" }, "Describe what you observed."],
  [{ location_name: "" }, "Enter the location."],
  [{ category_id: "inactive" }, "Choose an active category."],
  [{ trace_media: [] }, "Add at least one photo before submitting."],
  [{ trace_media: [{ ...photo, mime_type: "video/mp4" }] }, "Add at least one photo before submitting."],
])("blocks incomplete drafts: %j", async (overrides, text) => {
  const calls = submissionSetup((url) => url === detail ? response(complete(overrides)) : undefined);
  open(`/user/contributions/${trace().id}`);
  fireEvent.click(await ready());
  expect(await screen.findByText(text)).toBeTruthy();
  expect(calls.mock.calls.some(([url]) => url === submit)).toBe(false);
});

it("rechecks category availability before posting", async () => {
  let active = true;
  const calls = submissionSetup((url) => {
    if (url === detail) return response(complete());
    if (url === "/api/categories") return response(active ? [category] : []);
  });
  open(`/user/contributions/${trace().id}`);
  const button = await ready();
  active = false;
  fireEvent.click(button);
  expect((await screen.findByRole("alert")).textContent).toMatch(/active category/);
  expect(calls.mock.calls.some(([url]) => url === submit)).toBe(false);
});

it("shows another tab's changed details before allowing submission", async () => {
  let saved = complete();
  const calls = submissionSetup((url) => url === detail ? response(saved) : undefined);
  open(`/user/contributions/${trace().id}`);
  const button = await ready();
  saved = complete({ title: "Changed elsewhere", version: 2 });
  fireEvent.click(button);
  expect((await screen.findByRole("alert")).textContent).toMatch(/Review the updated Trace/);
  expect(screen.getByRole("heading", { name: "Changed elsewhere" })).toBeTruthy();
  expect(calls.mock.calls.some(([url]) => url === submit)).toBe(false);
});

it("blocks duplicate clicks and attachment changes while submission is pending", async () => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const calls = submissionSetup((url) => url === detail ? response(complete()) : url === submit ? pending : undefined);
  open(`/user/contributions/${trace().id}`);
  const button = await ready();
  fireEvent.click(button);
  fireEvent.click(button);
  await waitFor(() => expect(calls.mock.calls.filter(([url]) => url === submit)).toHaveLength(1));
  expect(screen.getByRole("button", { name: "Remove photo 1" }).disabled).toBe(true);
  expect(screen.getByLabelText("Choose a photo").disabled).toBe(true);
  await act(async () => finish(response(complete({ status: "pending", version: 2 }))));
  await screen.findByText(/Your Trace is awaiting a reviewer/);
});

it("uploads the selected photo on submit and uses the version after upload", async () => {
  let saved = complete();
  const calls = submissionSetup((url) => {
    if (url === detail) return response(saved);
    if (url === `/api/traces/${trace().id}/media`) { saved = complete({ version: 3 }); return response(photo); }
    if (url === submit) return response(complete({ status: "pending", version: 4 }));
  });
  open(`/user/contributions/${trace().id}`);
  const button = await ready();
  const file = new File([new Uint8Array(12)], "photo.png", { type: "image/png" });
  fireEvent.change(screen.getByLabelText("Choose a photo"), { target: { files: [file] } });
  expect(button.disabled).toBe(false);
  expect(screen.queryByRole("button", { name: "Upload photo" })).toBeNull();
  expect(calls.mock.calls.some(([url]) => url.endsWith("/media"))).toBe(false);
  fireEvent.click(button);
  await screen.findByText(/Your Trace is awaiting a reviewer/);
  expect(JSON.parse(calls.mock.calls.find(([url]) => url === submit)[1].body)).toEqual({ version: 3 });
});

it.each([409, 502])("requires a status reload after submission failure %s and never replays the write", async (status) => {
  let saved = complete();
  const calls = submissionSetup((url) => url === detail ? response(saved) : url === submit ? failure(status) : undefined);
  open(`/user/contributions/${trace().id}`);
  fireEvent.click(await ready());
  await screen.findByRole("alert");
  expect(screen.getByRole("button", { name: "Submit for review" }).disabled).toBe(true);
  saved = complete({ status: "pending", version: 2 });
  fireEvent.click(screen.getByRole("button", { name: "Reload saved Trace" }));
  await screen.findByText(/Your Trace is awaiting a reviewer/);
  expect(calls.mock.calls.filter(([url]) => url === submit)).toHaveLength(1);
});

it("does not post when the latest saved Trace is already pending", async () => {
  let saved = complete();
  const calls = submissionSetup((url) => url === detail ? response(saved) : undefined);
  open(`/user/contributions/${trace().id}`);
  const button = await ready();
  saved = complete({ status: "pending", version: 2 });
  fireEvent.click(button);
  await screen.findByText(/Your Trace is awaiting a reviewer/);
  expect(calls.mock.calls.some(([url]) => url === submit)).toBe(false);
});

it("discards a submission response after logout", async () => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const calls = submissionSetup((url) => url === detail ? response(complete()) : url === submit ? pending : undefined);
  open(`/user/contributions/${trace().id}`);
  fireEvent.click(await ready());
  await waitFor(() => expect(calls.mock.calls.some(([url]) => url === submit)).toBe(true));
  fireEvent.click(screen.getByTitle("Profile"));
  fireEvent.click(await screen.findByRole("button", { name: /Usage & activity/ }));
  fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  await screen.findByRole("heading", { name: "Welcome to TideTrace" });
  await act(async () => finish(response(complete({ status: "pending", version: 2 }))));
  expect(screen.queryByText(/Your Trace is awaiting a reviewer/)).toBeNull();
});

it("validates the photo inline on submit after the last attachment is removed", async () => {
  const calls = submissionSetup((url, options) => {
    if (url === detail) return response(complete());
    if (url === `/api/media/${photo.id}` && options.method === "DELETE") return { ok: true, status: 204 };
  });
  open(`/user/contributions/${trace().id}`);
  await ready();
  fireEvent.click(screen.getByRole("button", { name: "Remove photo 1" }));
  await screen.findByText("Photo removed from this draft.");
  fireEvent.click(await ready());
  await screen.findByText("Add at least one photo before submitting.");
  expect(calls.mock.calls.some(([url]) => url === submit)).toBe(false);
});

it("allows retrying category reads without allowing submission during a category error", async () => {
  let works = false;
  const calls = submissionSetup((url) => {
    if (url === detail) return response(complete());
    if (url === "/api/categories") return works ? response([category]) : failure();
  });
  open(`/user/contributions/${trace().id}`);
  await screen.findByRole("alert");
  expect(screen.getByRole("button", { name: "Submit for review" }).disabled).toBe(true);
  works = true;
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await ready();
  expect(calls.mock.calls.some(([url]) => url === submit)).toBe(false);
});

it("validates draft details before uploading a selected photo", async () => {
  const calls = submissionSetup((url) => url === detail ? response(complete({ title: "", trace_media: [] })) : undefined);
  open(`/user/contributions/${trace().id}`);
  const button = await ready();
  fireEvent.change(screen.getByLabelText("Choose a photo"), { target: { files: [new File(["photo"], "coast.png", { type: "image/png" })] } });
  fireEvent.click(button);
  await screen.findByText("Enter a title.");
  expect(screen.queryByText("Add at least one photo before submitting.")).toBeNull();
  expect(calls.mock.calls.some(([, options]) => options.method === "POST")).toBe(false);
});

it("keeps an uploaded photo when submission fails and retries only submission", async () => {
  let saved = complete({ trace_media: [] });
  let attempts = 0;
  const calls = submissionSetup((url) => {
    if (url === detail) return response(saved);
    if (url === `/api/traces/${trace().id}/media`) { saved = complete({ version: 2 }); return response(photo); }
    if (url === submit) return ++attempts === 1 ? failure(400) : response(complete({ status: "pending", version: 3 }));
  });
  open(`/user/contributions/${trace().id}`);
  await ready();
  fireEvent.change(screen.getByLabelText("Choose a photo"), { target: { files: [new File(["photo"], "coast.png", { type: "image/png" })] } });
  fireEvent.click(await ready());
  await screen.findByRole("alert");
  fireEvent.click(await ready());
  await screen.findByText(/Your Trace is awaiting a reviewer/);
  expect(calls.mock.calls.filter(([url]) => url.endsWith("/media"))).toHaveLength(1);
  expect(calls.mock.calls.filter(([url]) => url === submit)).toHaveLength(2);
});

it("requires reviewing concurrent text changes after uploading before it submits", async () => {
  let saved = complete({ trace_media: [] });
  const calls = submissionSetup((url) => {
    if (url === detail) return response(saved);
    if (url === `/api/traces/${trace().id}/media`) { saved = complete({ title: "Edited during upload", version: 3 }); return response(photo); }
  });
  open(`/user/contributions/${trace().id}`);
  await ready();
  fireEvent.change(screen.getByLabelText("Choose a photo"), { target: { files: [new File(["photo"], "coast.png", { type: "image/png" })] } });
  fireEvent.click(await ready());
  await screen.findByText(/saved details changed during upload/);
  expect(screen.getByRole("heading", { name: "Edited during upload" })).toBeTruthy();
  expect(calls.mock.calls.some(([url]) => url === submit)).toBe(false);
});
