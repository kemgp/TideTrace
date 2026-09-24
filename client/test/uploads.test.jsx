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

const photo = { id: "40000000-0000-4000-8000-000000000001", trace_id: trace().id, object_path: "current-user/trace/photo.png", mime_type: "image/png", size_bytes: 12, sort_order: 0 };
const png = () => new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])], "coast.png", { type: "image/png" });
const detail = `/api/contributions/${trace().id}`;
const upload = `/api/traces/${trace().id}/media`;
const choose = async (file = png()) => fireEvent.change(await screen.findByLabelText("Choose a photo"), { target: { files: [file] } });

it("uploads raw photo bytes with authentication, displays the saved image, and removes it", async () => {
  let saved = trace({ trace_media: [] });
  const calls = setup((url, options) => {
    if (url === detail) return response(saved);
    if (url === upload) { saved = { ...saved, trace_media: [photo], version: 2 }; return response(photo); }
    if (url === `/api/media/${photo.id}/url`) return response({ url: "https://project.supabase.co/photo.png?token=signed", expires_in: 60 });
    if (url === `/api/media/${photo.id}` && options.method === "DELETE") { saved = { ...saved, trace_media: [], version: 3 }; return { ok: true, status: 204, json: vi.fn(() => { throw new Error("No JSON body"); }) }; }
  });
  open(`/user/contributions/${trace().id}`);
  const file = png();
  await choose(file);
  fireEvent.click(screen.getByRole("button", { name: "Upload photo" }));
  const image = await screen.findByAltText("Trace photo 1");
  expect(image.getAttribute("src")).toContain("token=signed");
  const options = calls.mock.calls.find(([url]) => url === upload)[1];
  expect(options.body).toBe(file);
  expect(options.headers).toEqual({ Authorization: "Bearer live-access", "Content-Type": "image/png" });
  expect(options.method).toBe("POST");
  expect(screen.getByText("Photo uploaded and attached to your draft.")).toBeTruthy();
  // A fresh detail read reconstructs attachments from saved records.
  fireEvent.click(screen.getByRole("link", { name: "Edit draft" }));
  await screen.findByRole("heading", { name: "Edit your draft" });
  fireEvent.click(screen.getByRole("link", { name: /Back to contribution/ }));
  await screen.findByAltText("Trace photo 1");
  fireEvent.click(screen.getByRole("button", { name: "Remove photo 1" }));
  await screen.findByText("Photo removed from this draft.");
  expect(screen.queryByAltText("Trace photo 1")).toBeNull();
  expect(screen.getByText("No photos attached yet.")).toBeTruthy();
});

it.each([
  [new File(["hello"], "file.svg", { type: "image/svg+xml" }), /JPEG, PNG or WebP/],
  [new File([], "empty.png", { type: "image/png" }), /non-empty photo/],
  [new File([new Uint8Array(20 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }), /no larger than 20 MB/],
])("rejects invalid photo selections before making any upload request", async (file, message) => {
  const calls = setup((url) => url === detail ? response(trace({ trace_media: [] })) : undefined);
  open(`/user/contributions/${trace().id}`);
  await choose(file);
  expect((await screen.findByRole("alert")).textContent).toMatch(message);
  expect(screen.getByRole("button", { name: "Upload photo" }).disabled).toBe(true);
  expect(calls.mock.calls.some(([url]) => url === upload)).toBe(false);
});

it("retains the selection after validation errors and prevents duplicate in-flight uploads", async () => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const calls = setup((url) => url === detail ? response(trace({ trace_media: [] })) : url === upload ? pending : undefined);
  open(`/user/contributions/${trace().id}`);
  await choose();
  const button = screen.getByRole("button", { name: "Upload photo" });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(screen.getByLabelText("Photo operation in progress")).toBeTruthy();
  expect(button.disabled).toBe(true);
  await act(async () => finish({ ok: false, status: 400, json: async () => ({ error: { code: "INVALID_MEDIA", message: "The file does not match its declared content type." } }) }));
  expect((await screen.findByRole("alert")).textContent).toMatch(/does not match/);
  expect(screen.getByText("coast.png")).toBeTruthy();
  expect(button.disabled).toBe(false);
  expect(calls.mock.calls.filter(([url]) => url === upload)).toHaveLength(1);
});

it("recovers an uploaded file by retrying attachment without uploading its bytes again", async () => {
  const calls = setup((url) => {
    if (url === detail) return response(trace({ trace_media: [] }));
    if (url === upload) return { ok: false, status: 502, json: async () => ({ error: { code: "MEDIA_ATTACH_FAILED", message: "Attachment failed", details: { object_path: photo.object_path } } }) };
    if (url === `${upload}/attach`) return response(photo);
    if (url.endsWith("/url")) return response({ url: "https://project.supabase.co/photo.png" });
  });
  open(`/user/contributions/${trace().id}`);
  await choose();
  fireEvent.click(screen.getByRole("button", { name: "Upload photo" }));
  expect((await screen.findByRole("alert")).textContent).toMatch(/attaching it failed/);
  fireEvent.click(screen.getByRole("button", { name: "Retry attachment" }));
  await screen.findByAltText("Trace photo 1");
  expect(calls.mock.calls.filter(([url]) => url === upload)).toHaveLength(1);
  expect(JSON.parse(calls.mock.calls.find(([url]) => url === `${upload}/attach`)[1].body)).toEqual({ object_path: photo.object_path });
});

it("requires reloading saved attachments after an uncertain upload instead of replaying it", async () => {
  let saved = trace({ trace_media: [] });
  const calls = setup((url) => {
    if (url === detail) return response(saved);
    if (url === upload) { saved = trace({ trace_media: [photo] }); throw new TypeError("Lost response"); }
    if (url.endsWith("/url")) return response({ url: "https://project.supabase.co/photo.png" });
  });
  open(`/user/contributions/${trace().id}`);
  await choose();
  fireEvent.click(screen.getByRole("button", { name: "Upload photo" }));
  expect((await screen.findByRole("alert")).textContent).toMatch(/could not confirm/);
  expect(screen.getByRole("button", { name: "Upload photo" }).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Reload saved attachments" }));
  await screen.findByAltText("Trace photo 1");
  expect(calls.mock.calls.filter(([url]) => url === upload)).toHaveLength(1);
});

it("refreshes a failed preview with a new signed URL", async () => {
  let attempt = 0;
  const calls = setup((url) => {
    if (url === detail) return response(trace({ trace_media: [photo] }));
    if (url.endsWith("/url")) return response({ url: `https://project.supabase.co/photo.png?attempt=${++attempt}` });
  });
  open(`/user/contributions/${trace().id}`);
  const image = await screen.findByAltText("Trace photo 1");
  const previous = image.src;
  fireEvent.error(image);
  fireEvent.click(await screen.findByRole("button", { name: "Reload photo 1" }));
  expect((await screen.findByAltText("Trace photo 1")).src).not.toBe(previous);
  expect(calls.mock.calls.some(([url]) => url.endsWith("/url"))).toBe(true);
});

it.each([{ status: "pending" }, { status: "approved" }, { is_hidden: true }, { author_id: "someone-else" }])("disables attachment changes for noneditable records: %j", async (overrides) => {
  setup((url) => url === detail ? response(trace({ trace_media: [], ...overrides })) : undefined);
  open(`/user/contributions/${trace().id}`);
  await screen.findByText("No photos attached yet.");
  expect(screen.queryByLabelText("Choose a photo")).toBeNull();
  expect(screen.queryByRole("button", { name: "Upload photo" })).toBeNull();
});

it("does not show upload success or a preview after logout", async () => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  setup((url) => url === detail ? response(trace({ trace_media: [] })) : url === upload ? pending : undefined);
  open(`/user/contributions/${trace().id}`);
  await choose();
  fireEvent.click(screen.getByRole("button", { name: "Upload photo" }));
  fireEvent.click(screen.getByTitle("Profile"));
  fireEvent.click(await screen.findByRole("button", { name: /Usage & activity/ }));
  fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  await screen.findByRole("heading", { name: "Welcome to TideTrace" });
  await act(async () => finish(response(photo)));
  expect(screen.queryByText("Photo uploaded and attached to your draft.")).toBeNull();
  expect(screen.queryByAltText("Trace photo 1")).toBeNull();
});

async function prepareInitialPhoto(file = png()) {
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL = vi.fn(() => "blob:selected-photo");
    static revokeObjectURL = vi.fn();
  });
  open("/user/traces/upload");
  await screen.findByRole("option", { name: "Seagrass" });
  fireEvent.change(screen.getByLabelText("Category (required)"), { target: { value: category.id } });
  fireEvent.change(screen.getByLabelText("Choose a photo (optional)"), { target: { files: [file] } });
}

it("selects and previews a photo on the initial form, then saves before uploading", async () => {
  let saved;
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const calls = setup((url, options) => {
    if (url === "/api/traces" && options.method === "POST") { saved = trace({ ...JSON.parse(options.body), trace_media: [] }); return response(saved); }
    if (url === upload) { expect(saved).toBeTruthy(); saved = { ...saved, trace_media: [photo] }; return pending; }
    if (url === detail) return response(saved);
    if (url.endsWith("/url")) return response({ url: "https://project.supabase.co/photo.png" });
  });
  const file = png();
  await prepareInitialPhoto(file);
  expect(await screen.findByAltText("Selected photo preview")).toBeTruthy();
  expect(calls.mock.calls.some(([, options]) => options.method === "POST")).toBe(false);
  const button = screen.getByRole("button", { name: "Save draft" });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(await screen.findByRole("button", { name: "Uploading photo…" })).toBeTruthy();
  await act(async () => finish(response(photo)));
  await screen.findByAltText("Trace photo 1");
  const writes = calls.mock.calls.filter(([, options]) => options.method === "POST");
  expect(writes.map(([url]) => url)).toEqual(["/api/traces", upload]);
  expect(writes[1][1].body).toBe(file);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:selected-photo");
});

it("can remove a selected initial photo and save without uploading it", async () => {
  const calls = setup((url) => url === "/api/traces" || url === detail ? response(trace({ trace_media: [] })) : undefined);
  await prepareInitialPhoto();
  await screen.findByAltText("Selected photo preview");
  fireEvent.click(screen.getByRole("button", { name: "Remove selected photo" }));
  expect(screen.queryByAltText("Selected photo preview")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await screen.findByRole("link", { name: "Edit draft" });
  expect(calls.mock.calls.some(([url]) => url === upload)).toBe(false);
});

it("rejects an unsupported photo on the initial form before any write", async () => {
  const calls = setup(() => undefined);
  await prepareInitialPhoto(new File(["svg"], "bad.svg", { type: "image/svg+xml" }));
  expect((await screen.findByRole("alert")).textContent).toMatch(/JPEG, PNG or WebP/);
  expect(screen.queryByAltText("Selected photo preview")).toBeNull();
  expect(calls.mock.calls.some(([, options]) => options.method === "POST")).toBe(false);
});

it("does not upload the initial photo if draft creation fails", async () => {
  const calls = setup((url) => url === "/api/traces" ? failure(400) : undefined);
  await prepareInitialPhoto();
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await screen.findByRole("alert");
  expect(screen.getByAltText("Selected photo preview")).toBeTruthy();
  expect(calls.mock.calls.some(([url]) => url === upload)).toBe(false);
});

it("recovers an initial attachment failure without creating another draft or uploading again", async () => {
  const calls = setup((url) => {
    if (url === "/api/traces" || url === detail) return response(trace({ trace_media: [] }));
    if (url === upload) return { ok: false, status: 502, json: async () => ({ error: { code: "MEDIA_ATTACH_FAILED", message: "Attachment failed", details: { object_path: photo.object_path } } }) };
    if (url === `${upload}/attach`) return response(photo);
    if (url.endsWith("/url")) return response({ url: "https://project.supabase.co/photo.png" });
  });
  await prepareInitialPhoto();
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await screen.findByRole("heading", { name: "Draft saved" });
  expect(screen.queryByRole("button", { name: "Save draft" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Retry attachment" }));
  await screen.findByAltText("Trace photo 1");
  expect(calls.mock.calls.filter(([url]) => url === "/api/traces")).toHaveLength(1);
  expect(calls.mock.calls.filter(([url]) => url === upload)).toHaveLength(1);
});

it("requires checking saved attachments when the initial photo upload outcome is unknown", async () => {
  const calls = setup((url) => {
    if (url === "/api/traces") return response(trace({ trace_media: [] }));
    if (url === upload) throw new TypeError("Lost upload response");
    if (url === detail) return response(trace({ trace_media: [photo] }));
    if (url.endsWith("/url")) return response({ url: "https://project.supabase.co/photo.png" });
  });
  await prepareInitialPhoto();
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await screen.findByRole("heading", { name: "Draft saved" });
  expect(screen.getByRole("button", { name: "Upload photo" }).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Reload saved attachments" }));
  await screen.findByAltText("Trace photo 1");
  expect(calls.mock.calls.filter(([url]) => url === "/api/traces")).toHaveLength(1);
  expect(calls.mock.calls.filter(([url]) => url === upload)).toHaveLength(1);
});
