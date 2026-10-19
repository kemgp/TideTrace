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
const submit = `/api/traces/${trace().id}/submit`;
const upload = `/api/traces/${trace().id}/media`;
const choose = async (file = png()) => fireEvent.change(await screen.findByLabelText("Choose a photo"), { target: { files: [file] } });

it("uploads raw photo bytes on submission, then allows removal if submission is rejected", async () => {
  let saved = trace({ trace_media: [] });
  const calls = setup((url, options) => {
    if (url === detail) return response(saved);
    if (url === submit) return failure(400);
    if (url === upload) { saved = { ...saved, trace_media: [photo], version: 2 }; return response(photo); }
    if (url === `/api/media/${photo.id}/url`) return response({ url: "https://project.supabase.co/photo.png?token=signed", expires_in: 60 });
    if (url === `/api/media/${photo.id}` && options.method === "DELETE") { saved = { ...saved, trace_media: [], version: 3 }; return { ok: true, status: 204, json: vi.fn(() => { throw new Error("No JSON body"); }) }; }
  });
  open(`/user/contributions/${trace().id}`);
  const file = png();
  await choose(file);
  fireEvent.click(await submitButton());
  const image = await screen.findByAltText("Trace photo 1");
  expect(image.getAttribute("src")).toContain("token=signed");
  const options = calls.mock.calls.find(([url]) => url === upload)[1];
  expect(options.body).toBe(file);
  expect(options.headers).toEqual({ Authorization: "Bearer live-access", "Content-Type": "image/png" });
  expect(options.method).toBe("POST");
  await screen.findByRole("alert");
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
  expect(screen.queryByRole("button", { name: "Upload photo" })).toBeNull();
  expect(calls.mock.calls.some(([url]) => url === upload)).toBe(false);
});

it("retains the selection after validation errors and prevents duplicate in-flight uploads", async () => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const calls = setup((url) => url === detail ? response(trace({ trace_media: [] })) : url === upload ? pending : undefined);
  open(`/user/contributions/${trace().id}`);
  await choose();
  const button = await submitButton();
  fireEvent.click(button);
  fireEvent.click(button);
  expect(await screen.findByRole("button", { name: "Uploading photo…" })).toBeTruthy();
  expect(screen.queryByRole("progressbar")).toBeNull();
  expect(button.disabled).toBe(true);
  await act(async () => finish({ ok: false, status: 400, json: async () => ({ error: { code: "INVALID_MEDIA", message: "The file does not match its declared content type." } }) }));
  expect((await screen.findByRole("alert")).textContent).toMatch(/does not match/);
  expect(screen.getByText("coast.png")).toBeTruthy();
  expect(button.disabled).toBe(false);
  expect(calls.mock.calls.filter(([url]) => url === upload)).toHaveLength(1);
});

it("recovers an uploaded file by submitting again without uploading its bytes again", async () => {
  let saved = trace({ trace_media: [] });
  const calls = setup((url) => {
    if (url === detail) return response(saved);
    if (url === submit) { saved = { ...saved, status: "pending", version: 3 }; return response(saved); }
    if (url === upload) return { ok: false, status: 502, json: async () => ({ error: { code: "MEDIA_ATTACH_FAILED", message: "Attachment failed", details: { object_path: photo.object_path } } }) };
    if (url === `${upload}/attach`) { saved = { ...saved, trace_media: [photo], version: 2 }; return response(photo); }
    if (url.endsWith("/url")) return response({ url: "https://project.supabase.co/photo.png" });
  });
  open(`/user/contributions/${trace().id}`);
  await choose();
  fireEvent.click(await submitButton());
  expect((await screen.findByRole("alert")).textContent).toMatch(/attaching it failed/);
  fireEvent.click(await submitButton());
  await screen.findByText(/Your Trace is awaiting a reviewer/);
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
  fireEvent.click(await submitButton());
  expect((await screen.findByRole("alert")).textContent).toMatch(/could not confirm/);
  expect(screen.getByRole("button", { name: "Submit for review" }).disabled).toBe(true);
  await waitFor(() => expect(screen.getByRole("button", { name: "Reload saved attachments" }).disabled).toBe(false));
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
  fireEvent.click(await submitButton());
  fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  await screen.findByRole("heading", { name: "Welcome to TideTrace" });
  await act(async () => finish(response(photo)));
  expect(screen.queryByText("Photo uploaded and attached to your draft.")).toBeNull();
  expect(screen.queryByAltText("Trace photo 1")).toBeNull();
});

async function submitButton() {
  const button = await screen.findByRole("button", { name: "Submit for review" });
  await waitFor(() => expect(button.disabled).toBe(false));
  return button;
}

async function prepareInitialPhoto(file = png()) {
  open("/user/traces/upload");
  await screen.findByRole("option", { name: "Seagrass" });
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: trace().title } });
  fireEvent.change(screen.getByLabelText("Description"), { target: { value: trace().description } });
  fireEvent.change(screen.getByLabelText("Location"), { target: { value: trace().location_name } });
  fireEvent.change(screen.getByLabelText("Category (required)"), { target: { value: category.id } });
  fireEvent.change(screen.getByLabelText(/^Choose a photo/), { target: { files: [file] } });
}

it("selects and previews a photo on the initial form, then saves before uploading", async () => {
  let saved;
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const calls = setup((url, options) => {
    if (url === "/api/traces" && options.method === "POST") { saved = trace({ ...JSON.parse(options.body), trace_media: [] }); return response(saved); }
    if (url === upload) { expect(saved).toBeTruthy(); saved = { ...saved, trace_media: [photo], version: 2 }; return pending; }
    if (url === submit) { saved = { ...saved, status: "pending", version: 3 }; return response(saved); }
    if (url === detail) return response(saved);
    if (url.endsWith("/url")) return response({ url: "https://project.supabase.co/photo.png" });
  });
  const file = png();
  await prepareInitialPhoto(file);
  const preview = await screen.findByAltText("Selected photo preview");
  const previewURL = preview.getAttribute("src");
  expect(calls.mock.calls.some(([, options]) => options.method === "POST")).toBe(false);
  const button = screen.getByRole("button", { name: "Submit Trace" });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(await screen.findByRole("button", { name: "Uploading photo…" })).toBeTruthy();
  await act(async () => finish(response(photo)));
  await screen.findByAltText("Trace photo 1");
  const writes = calls.mock.calls.filter(([, options]) => options.method === "POST");
  expect(writes.map(([url]) => url)).toEqual(["/api/traces", upload, submit]);
  expect(writes[1][1].body).toBe(file);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith(previewURL);
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
  let saved = trace({ trace_media: [], latitude: null, longitude: null });
  const calls = setup((url) => {
    if (url === "/api/traces" || url === detail) return response(saved);
    if (url === submit) { saved = { ...saved, status: "pending", version: 3 }; return response(saved); }
    if (url === upload) return { ok: false, status: 502, json: async () => ({ error: { code: "MEDIA_ATTACH_FAILED", message: "Attachment failed", details: { object_path: photo.object_path } } }) };
    if (url === `${upload}/attach`) { saved = { ...saved, trace_media: [photo], version: 2 }; return response(photo); }
    if (url.endsWith("/url")) return response({ url: "https://project.supabase.co/photo.png" });
  });
  await prepareInitialPhoto();
  fireEvent.click(screen.getByRole("button", { name: "Submit Trace" }));
  await screen.findByRole("heading", { name: "Draft saved" });
  expect(screen.queryByRole("button", { name: "Save draft" })).toBeNull();
  fireEvent.click(await submitButton());
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
  fireEvent.click(screen.getByRole("button", { name: "Submit Trace" }));
  await screen.findByRole("heading", { name: "Draft saved" });
  expect(screen.getByRole("button", { name: "Submit for review" }).disabled).toBe(true);
  await waitFor(() => expect(screen.getByRole("button", { name: "Reload saved attachments" }).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Reload saved attachments" }));
  await screen.findByAltText("Trace photo 1");
  expect(calls.mock.calls.filter(([url]) => url === "/api/traces")).toHaveLength(1);
  expect(calls.mock.calls.filter(([url]) => url === upload)).toHaveLength(1);
});

it("shows draft save then upload progress, blocks duplicate actions, and waits for attachment confirmation", async () => {
  let finishSave, finishUpload, finishRead;
  const savePending = new Promise(resolve => { finishSave = resolve; });
  const uploadPending = new Promise(resolve => { finishUpload = resolve; });
  const readPending = new Promise(resolve => { finishRead = resolve; });
  const saved = trace({ trace_media: [photo], version: 2 });
  const calls = setup((url) => {
    if (url === "/api/traces") return savePending;
    if (url === upload) return uploadPending;
    if (url === detail) return readPending;
    if (url.endsWith("/url")) return response({ url: "https://project.supabase.co/photo.png" });
  });
  await prepareInitialPhoto();
  const button = screen.getByRole("button", { name: "Save draft" });
  fireEvent.click(button);
  fireEvent.click(button);
  fireEvent.click(screen.getByRole("button", { name: "Submit Trace" }));
  expect(screen.getByRole("button", { name: "Saving draft…" }).disabled).toBe(true);
  expect(calls.mock.calls.some(([url]) => url === upload)).toBe(false);
  await act(async () => finishSave(response(trace({ trace_media: [] }))));
  expect(screen.getByRole("button", { name: "Uploading photo…" }).disabled).toBe(true);
  expect(screen.queryByText(/Draft saved\./)).toBeNull();
  await act(async () => finishUpload(response(photo)));
  expect(screen.getByRole("button", { name: "Uploading photo…" }).disabled).toBe(true);
  expect(screen.queryByText(/Draft saved\./)).toBeNull();
  await act(async () => finishRead(response(saved)));
  await screen.findByAltText("Trace photo 1");
  expect(screen.getByText("Draft")).toBeTruthy();
  expect(calls.mock.calls.filter(([, options]) => options.method === "POST").map(([url]) => url)).toEqual(["/api/traces", upload]);
});

it("reopens the photo saved with a draft and later submits its current version without another upload", async () => {
  let saved;
  const calls = setup((url, options) => {
    if (url === "/api/traces") { saved = trace({ ...JSON.parse(options.body), trace_media: [] }); return response(saved); }
    if (url === upload) { saved = { ...saved, trace_media: [photo], version: 2 }; return response(photo); }
    if (url === detail) return response(saved);
    if (url.startsWith("/api/contributions?")) return response([saved]);
    if (url === submit) { expect(JSON.parse(options.body)).toEqual({ version: 2 }); saved = { ...saved, status: "pending", version: 3 }; return response(saved); }
    if (url.endsWith("/url")) return response({ url: "https://project.supabase.co/photo.png" });
  });
  await prepareInitialPhoto();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save draft" })));
  await screen.findByAltText("Trace photo 1");
  expect(saved.status).toBe("draft");
  fireEvent.click(screen.getByRole("link", { name: /Back to My Contributions/ }));
  fireEvent.click(await screen.findByText(saved.title));
  await screen.findByAltText("Trace photo 1");
  fireEvent.click(await submitButton());
  await screen.findByText(/Your Trace is awaiting a reviewer/);
  expect(calls.mock.calls.filter(([, options]) => options.method === "POST").map(([url]) => url)).toEqual(["/api/traces", upload, submit]);
});

it("retains a category-only draft and selected photo after a definite upload failure, with a save-only retry", async () => {
  let saved, attempts = 0, finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const calls = setup((url, options) => {
    if (url === "/api/traces") { saved = trace({ ...JSON.parse(options.body), trace_media: [] }); return response(saved); }
    if (url === upload) {
      if (++attempts === 1) return failure(400);
      saved = { ...saved, trace_media: [photo], version: 2 };
      return pending;
    }
    if (url === detail) return response(saved);
    if (url.endsWith("/url")) return response({ url: "https://project.supabase.co/photo.png" });
  });
  await prepareInitialPhoto();
  for (const label of ["Title", "Description", "Location"]) fireEvent.change(screen.getByLabelText(label), { target: { value: "" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save draft" })));
  await screen.findByRole("heading", { name: "Draft details saved" });
  expect(screen.getByText(/Your Trace details were saved/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Open saved draft" }).getAttribute("href")).toContain(saved.id);
  expect(screen.queryByRole("button", { name: "Submit for review" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Save draft" })).toBeNull();
  expect(await screen.findByAltText("Selected photo preview")).toBeTruthy();
  const retry = screen.getByRole("button", { name: "Retry photo upload" });
  fireEvent.click(retry);
  fireEvent.click(retry);
  await screen.findByRole("button", { name: "Uploading photo…" });
  await act(async () => finish(response(photo)));
  await screen.findByText(/Your details and photo are saved/);
  expect(saved.status).toBe("draft");
  expect(calls.mock.calls.filter(([url]) => url === "/api/traces")).toHaveLength(1);
  expect(calls.mock.calls.filter(([url]) => url === upload)).toHaveLength(2);
  expect(calls.mock.calls.some(([url]) => url === submit)).toBe(false);
});

it.each([false, true])("recovers draft attachment without uploading bytes again, including already attached paths: %s", async (alreadyAttached) => {
  let saved = trace({ trace_media: [] });
  const calls = setup((url) => {
    if (url === "/api/traces" || url === detail) return response(saved);
    if (url === upload) {
      if (alreadyAttached) saved = { ...saved, trace_media: [photo], version: 2 };
      return { ok: false, status: 502, json: async () => ({ error: { code: "MEDIA_ATTACH_FAILED", message: "Attachment failed", details: { object_path: photo.object_path } } }) };
    }
    if (url === `${upload}/attach`) { saved = { ...saved, trace_media: [photo], version: 2 }; return response(photo); }
    if (url.endsWith("/url")) return response({ url: "https://project.supabase.co/photo.png" });
  });
  await prepareInitialPhoto();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save draft" })));
  const retry = await screen.findByRole("button", { name: "Retry attachment" });
  fireEvent.click(retry);
  fireEvent.click(retry);
  await screen.findByText(/Your details and photo are saved/);
  expect(calls.mock.calls.filter(([url]) => url === upload)).toHaveLength(1);
  expect(calls.mock.calls.filter(([url]) => url === `${upload}/attach`)).toHaveLength(alreadyAttached ? 0 : 1);
  if (!alreadyAttached) expect(JSON.parse(calls.mock.calls.find(([url]) => url === `${upload}/attach`)[1].body)).toEqual({ object_path: photo.object_path });
  expect(calls.mock.calls.filter(([url]) => url === "/api/traces")).toHaveLength(1);
  expect(calls.mock.calls.some(([url]) => url === submit)).toBe(false);
});

it.each(["network", "invalid", "server"])("blocks a second draft upload after an uncertain %s response until attachments reload", async (outcome) => {
  let saved = trace({ trace_media: [] });
  let reloadWorks = false;
  const calls = setup((url) => {
    if (url === "/api/traces") return response(saved);
    if (url === detail) return reloadWorks ? response(saved) : failure();
    if (url === upload) {
      saved = { ...saved, trace_media: [photo], version: 2 };
      if (outcome === "network") throw new TypeError("Lost response");
      return outcome === "invalid" ? response({}) : failure();
    }
    if (url.endsWith("/url")) return response({ url: "https://project.supabase.co/photo.png" });
  });
  await prepareInitialPhoto();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save draft" })));
  await screen.findByRole("heading", { name: "Draft details saved" });
  expect(screen.getByRole("alert").textContent).toMatch(/could not confirm/);
  expect(screen.getByRole("button", { name: "Retry photo upload" }).disabled).toBe(true);
  expect(screen.getByLabelText("Choose a photo").disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Reload saved attachments" }));
  await screen.findByRole("alert");
  await waitFor(() => expect(screen.getByRole("button", { name: "Reload saved attachments" }).disabled).toBe(false));
  expect(screen.getByLabelText("Choose a photo").disabled).toBe(true);
  reloadWorks = true;
  fireEvent.click(screen.getByRole("button", { name: "Reload saved attachments" }));
  await screen.findByAltText("Trace photo 1");
  expect(screen.queryByAltText("Selected photo preview")).toBeNull();
  expect(calls.mock.calls.filter(([url]) => url === upload)).toHaveLength(1);
  expect(calls.mock.calls.some(([url]) => url === submit)).toBe(false);
});

it("checks saved attachments after photo verification fails without uploading again", async () => {
  let saved = trace({ trace_media: [] }), readsWork = false;
  const calls = setup((url) => {
    if (url === "/api/traces") return response(saved);
    if (url === upload) { saved = { ...saved, trace_media: [photo], version: 2 }; return response(photo); }
    if (url === detail) return readsWork ? response(saved) : failure();
    if (url.endsWith("/url")) return response({ url: "https://project.supabase.co/photo.png" });
  });
  await prepareInitialPhoto();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save draft" })));
  await screen.findByRole("heading", { name: "Draft details saved" });
  expect(screen.getByRole("button", { name: "Retry attachment" }).disabled).toBe(true);
  readsWork = true;
  fireEvent.click(screen.getByRole("button", { name: "Reload saved attachments" }));
  await screen.findByAltText("Trace photo 1");
  expect(calls.mock.calls.filter(([url]) => url === upload)).toHaveLength(1);
});

it.each(["logout", "navigate"])("cancels draft photo saving on %s without late success or another write", async (action) => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const calls = setup((url) => url === "/api/traces" ? response(trace()) : url === upload ? pending : undefined);
  await prepareInitialPhoto();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save draft" })));
  await screen.findByRole("button", { name: "Uploading photo…" });
  if (action === "logout") {
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    await screen.findByRole("heading", { name: "Welcome to TideTrace" });
  } else {
    fireEvent.click(screen.getByRole("link", { name: "Back to My Contributions" }));
    await screen.findByRole("heading", { name: "Your traces & their status" });
  }
  expect(calls.mock.calls.find(([url]) => url === upload)[1].signal.aborted).toBe(true);
  await act(async () => finish(response(photo)));
  expect(screen.queryByText(/Draft saved\./)).toBeNull();
  expect(screen.queryByAltText("Trace photo 1")).toBeNull();
  expect(calls.mock.calls.filter(([url, options]) => options.method === "POST" && !url.startsWith("/api/auth/")).map(([url]) => url)).toEqual(["/api/traces", upload]);
});

it("loads the version and concurrent edits saved during draft upload before editing again", async () => {
  let saved;
  const calls = setup((url, options) => {
    if (url === "/api/traces") { saved = trace({ ...JSON.parse(options.body), trace_media: [] }); return response(saved); }
    if (url === upload) { saved = { ...saved, title: "Concurrent title", trace_media: [photo], version: 5 }; return response(photo); }
    if (url === detail) return response(saved);
    if (url === `/api/traces/${trace().id}`) { expect(JSON.parse(options.body).version).toBe(5); saved = { ...saved, ...JSON.parse(options.body), version: 6 }; return response(saved); }
    if (url.endsWith("/url")) return response({ url: "https://project.supabase.co/photo.png" });
  });
  await prepareInitialPhoto();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save draft" })));
  await screen.findByRole("heading", { name: "Concurrent title" });
  fireEvent.click(screen.getByRole("link", { name: "Edit draft" }));
  await screen.findByDisplayValue("Concurrent title");
  fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Later observation" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save draft" })));
  await screen.findByAltText("Trace photo 1");
  expect(saved.title).toBe("Concurrent title");
  expect(calls.mock.calls.filter(([url]) => url === upload)).toHaveLength(1);
  expect(calls.mock.calls.some(([url]) => url === submit)).toBe(false);
});

it("requires an explicit new selection when an uncertain upload reload finds no attachment", async () => {
  let saved = trace({ trace_media: [] }), attempts = 0;
  const calls = setup((url) => {
    if (url === "/api/traces" || url === detail) return response(saved);
    if (url === upload) {
      if (++attempts === 1) throw new TypeError("Unknown upload outcome");
      saved = { ...saved, trace_media: [photo], version: 2 };
      return response(photo);
    }
    if (url.endsWith("/url")) return response({ url: "https://project.supabase.co/photo.png" });
  });
  await prepareInitialPhoto();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save draft" })));
  fireEvent.click(await screen.findByRole("button", { name: "Reload saved attachments" }));
  await screen.findByText(/Saved attachments reloaded/);
  expect(screen.queryByRole("button", { name: "Retry photo upload" })).toBeNull();
  expect(calls.mock.calls.filter(([url]) => url === upload)).toHaveLength(1);
  await choose();
  fireEvent.click(screen.getByRole("button", { name: "Retry photo upload" }));
  await screen.findByText(/Your details and photo are saved/);
  expect(calls.mock.calls.filter(([url]) => url === upload)).toHaveLength(2);
  expect(calls.mock.calls.filter(([url]) => url === "/api/traces")).toHaveLength(1);
  expect(calls.mock.calls.some(([url]) => url === submit)).toBe(false);
});

it("reloads after an uncertain attachment retry and never reuploads the existing object", async () => {
  let saved = trace({ trace_media: [] });
  const calls = setup((url) => {
    if (url === "/api/traces" || url === detail) return response(saved);
    if (url === upload) return { ok: false, status: 502, json: async () => ({ error: { code: "MEDIA_ATTACH_FAILED", message: "Attachment failed", details: { object_path: photo.object_path } } }) };
    if (url === `${upload}/attach`) { saved = { ...saved, trace_media: [photo], version: 4, title: "Concurrent edit" }; throw new TypeError("Lost attachment response"); }
    if (url.endsWith("/url")) return response({ url: "https://project.supabase.co/photo.png" });
  });
  await prepareInitialPhoto();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save draft" })));
  fireEvent.click(await screen.findByRole("button", { name: "Retry attachment" }));
  await screen.findByText(/We could not confirm the photo upload/);
  expect(screen.getByRole("button", { name: "Retry attachment" }).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Reload saved attachments" }));
  await screen.findByAltText("Trace photo 1");
  expect(calls.mock.calls.filter(([url]) => url === upload)).toHaveLength(1);
  expect(calls.mock.calls.filter(([url]) => url === `${upload}/attach`)).toHaveLength(1);
  fireEvent.click(screen.getByRole("link", { name: "Open saved draft" }));
  await screen.findByRole("heading", { name: "Concurrent edit" });
  expect(calls.mock.calls.some(([url]) => url === submit)).toBe(false);
});

it.each([{ author_id: "someone-else" }, { status: "pending" }, { is_hidden: true }])("rechecks ownership and editability before draft photo recovery: %j", async (changes) => {
  let saved = trace({ trace_media: [] });
  const calls = setup((url) => {
    if (url === "/api/traces" || url === detail) return response(saved);
    if (url === upload) return failure(400);
  });
  await prepareInitialPhoto();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save draft" })));
  const retry = await screen.findByRole("button", { name: "Retry photo upload" });
  saved = { ...saved, ...changes, version: 2 };
  fireEvent.click(retry);
  await waitFor(() => expect(calls.mock.calls.some(([url]) => url === detail)).toBe(true));
  await screen.findByRole("alert");
  expect(calls.mock.calls.filter(([url]) => url === upload)).toHaveLength(1);
  expect(calls.mock.calls.some(([url]) => url === submit)).toBe(false);
});

it.each(["logout", "navigate"])("cancels an attachment-only recovery on %s", async (action) => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const calls = setup((url) => {
    if (url === "/api/traces" || url === detail) return response(trace({ trace_media: [] }));
    if (url === upload) return { ok: false, status: 502, json: async () => ({ error: { code: "MEDIA_ATTACH_FAILED", message: "Attachment failed", details: { object_path: photo.object_path } } }) };
    if (url === `${upload}/attach`) return pending;
  });
  await prepareInitialPhoto();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save draft" })));
  fireEvent.click(await screen.findByRole("button", { name: "Retry attachment" }));
  await waitFor(() => expect(calls.mock.calls.some(([url]) => url === `${upload}/attach`)).toBe(true));
  if (action === "logout") {
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    await screen.findByRole("heading", { name: "Welcome to TideTrace" });
  } else {
    fireEvent.click(screen.getByRole("link", { name: "Open saved draft" }));
    await screen.findByRole("link", { name: "Edit draft" });
  }
  expect(calls.mock.calls.find(([url]) => url === `${upload}/attach`)[1].signal.aborted).toBe(true);
  await act(async () => finish(response(photo)));
  expect(screen.queryByText(/Your details and photo are saved/)).toBeNull();
  expect(calls.mock.calls.filter(([url]) => url === upload)).toHaveLength(1);
  expect(calls.mock.calls.some(([url]) => url === submit)).toBe(false);
});
