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

const photo = { id: "photo-id", trace_id: trace().id, mime_type: "image/png", sort_order: 0 };
const detail = `/api/contributions/${trace().id}`;
const media = `/api/traces/${trace().id}/media`;
const submitPath = `/api/traces/${trace().id}/submit`;
const file = () => new File([new Uint8Array(12)], "coast.png", { type: "image/png" });
const revision = (overrides = {}) => trace({ title: "Coast visit", description: "Updated evidence", location_name: "Lawis", latitude: null, longitude: null, trace_media: [photo], status: "revision_requested", version: 4, ...overrides });
async function fillForm({ addPhoto = true } = {}) {
  await screen.findByRole("option", { name: "Seagrass" });
  fireEvent.change(screen.getByLabelText("Category (required)"), { target: { value: category.id } });
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Coast visit" } });
  fireEvent.change(screen.getByLabelText("Location"), { target: { value: "Lawis" } });
  fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Updated evidence" } });
  if (addPhoto) {
    vi.stubGlobal("URL", class extends URL { static createObjectURL = () => "blob:photo"; static revokeObjectURL = () => {}; });
    fireEvent.change(screen.getByLabelText(/^Choose a photo/), { target: { files: [file()] } });
  }
}
function flowSetup({ uploadFailure, submitFailure, slowUpload } = {}) {
  let saved;
  const calls = setup((url, options) => {
    if (url === "/api/traces" && options.method === "POST") { saved = trace({ ...JSON.parse(options.body), trace_media: [] }); return response(saved); }
    if (url === media) {
      if (uploadFailure) return failure(400);
      saved = { ...saved, trace_media: [photo], version: 2 };
      return slowUpload || response(photo);
    }
    if (url === detail) return response(saved);
    if (url.endsWith("/url")) return response({ url: "https://project.supabase.co/photo.png" });
    if (url === submitPath) {
      saved = { ...saved, status: "pending", version: 3 };
      if (submitFailure) throw new TypeError("Lost submission response");
      return response(saved);
    }
  });
  return calls;
}

it("accepts a dropped photo, validates drops, and removes the selection without uploading", async () => {
  const calls = setup(() => undefined);
  vi.stubGlobal("URL", class extends URL { static createObjectURL = () => "blob:photo"; static revokeObjectURL = () => {}; });
  open("/user/traces/upload");
  const dropArea = (await screen.findByText("Drag and drop your photo here")).parentElement;
  fireEvent.drop(dropArea, { dataTransfer: { files: [file()] } });
  expect(screen.getByText("coast.png")).toBeTruthy();
  expect(screen.getByText(/Ready to upload/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Remove selected photo" }));
  expect(screen.queryByText("coast.png")).toBeNull();
  fireEvent.drop(dropArea, { dataTransfer: { files: [new File(["text"], "notes.txt", { type: "text/plain" })] } });
  expect(screen.getByRole("alert").textContent).toBe("Choose a JPEG, PNG or WebP photo.");
  fireEvent.drop(dropArea, { dataTransfer: { files: [file(), file()] } });
  expect(screen.getByRole("alert").textContent).toBe("Choose one photo at a time.");
  expect(calls.mock.calls.some(([, options]) => options.method === "POST")).toBe(false);
});

it("uses Submit Trace as primary, validates inline without writes, and clears corrected errors", async () => {
  const calls = setup(() => undefined);
  open("/user/traces/upload");
  await screen.findByRole("option", { name: "Seagrass" });
  const submit = screen.getByRole("button", { name: "Submit Trace" });
  const save = screen.getByRole("button", { name: "Save draft" });
  expect(submit.className).toContain("clay");
  expect(save.className).toContain("outline");
  expect(submit.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByText(/Title: Ready|Title: Required/)).toBeNull();
  fireEvent.click(submit);
  expect(screen.getAllByRole("alert")).toHaveLength(5);
  const title = screen.getByLabelText("Title");
  expect(title.getAttribute("aria-invalid")).toBe("true");
  expect(document.getElementById(title.getAttribute("aria-describedby")).textContent).toBe("Enter a title.");
  fireEvent.change(title, { target: { value: "My observation" } });
  expect(title.getAttribute("aria-invalid")).toBe("false");
  expect(screen.queryByText("Enter a title.")).toBeNull();
  expect(calls.mock.calls.some(([, options]) => options.method === "POST")).toBe(false);
});

it("allows an incomplete draft to be saved after a failed submit validation", async () => {
  const calls = flowSetup();
  open("/user/traces/upload");
  await screen.findByRole("option", { name: "Seagrass" });
  fireEvent.click(screen.getByRole("button", { name: "Submit Trace" }));
  fireEvent.change(screen.getByLabelText("Category (required)"), { target: { value: category.id } });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await screen.findByRole("heading", { name: "Untitled draft" });
  expect(calls.mock.calls.filter(([, options]) => options.method === "POST").map(([url]) => url)).toEqual(["/api/traces"]);
});

it("saves, uploads and submits in sequence with the post-upload version", async () => {
  const calls = flowSetup();
  open("/user/traces/upload");
  await fillForm();
  fireEvent.click(screen.getByRole("button", { name: "Submit Trace" }));
  await screen.findByText(/Your Trace is awaiting a reviewer/);
  const writes = calls.mock.calls.filter(([, options]) => options.method === "POST");
  expect(writes.map(([url]) => url)).toEqual(["/api/traces", media, submitPath]);
  expect(writes[1][1].body).toBeInstanceOf(File);
  expect(JSON.parse(writes[2][1].body)).toEqual({ version: 2 });
});

it("never submits when the photo upload fails and preserves the already-created draft", async () => {
  const calls = flowSetup({ uploadFailure: true });
  open("/user/traces/upload");
  await fillForm();
  fireEvent.click(screen.getByRole("button", { name: "Submit Trace" }));
  await screen.findByRole("heading", { name: "Draft saved" });
  expect(screen.getByRole("link", { name: "Open saved draft" }).getAttribute("href")).toBe(`/user/contributions/${trace().id}`);
  expect(calls.mock.calls.filter(([url]) => url === "/api/traces")).toHaveLength(1);
  expect(calls.mock.calls.some(([url]) => url === submitPath)).toBe(false);
});

it("does not recreate or resubmit automatically when the submission response is lost", async () => {
  const calls = flowSetup({ submitFailure: true });
  open("/user/traces/upload");
  await fillForm();
  fireEvent.click(screen.getByRole("button", { name: "Submit Trace" }));
  await screen.findByText(/could not confirm submission/);
  expect(screen.queryByRole("button", { name: "Submit Trace" })).toBeNull();
  fireEvent.click(screen.getByRole("link", { name: "Open saved Trace" }));
  await screen.findByText(/Your Trace is awaiting a reviewer/);
  expect(calls.mock.calls.filter(([url]) => url === "/api/traces")).toHaveLength(1);
  expect(calls.mock.calls.filter(([url]) => url === submitPath)).toHaveLength(1);
});

it("locks both actions during upload to prevent duplicate create/save requests", async () => {
  let finish;
  const slowUpload = new Promise((resolve) => { finish = resolve; });
  const calls = flowSetup({ slowUpload });
  open("/user/traces/upload");
  await fillForm();
  const submit = screen.getByRole("button", { name: "Submit Trace" });
  fireEvent.click(submit);
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await screen.findByRole("button", { name: "Uploading photo…" });
  expect(screen.getByRole("button", { name: "Save draft" }).disabled).toBe(true);
  await act(async () => finish(response(photo)));
  await screen.findByText(/Your Trace is awaiting a reviewer/);
  expect(calls.mock.calls.filter(([url]) => url === "/api/traces")).toHaveLength(1);
});

it("saves and resubmits revised form fields using the same Trace and new version", async () => {
  let saved = revision();
  const calls = setup((url, options) => {
    if (url === detail) return response(saved);
    if (options.method === "PUT") { saved = { ...saved, ...JSON.parse(options.body), version: 5 }; return response(saved); }
    if (url === submitPath) { saved = { ...saved, status: "pending", version: 6 }; return response(saved); }
    if (url.endsWith("/url")) return response({ url: "https://project.supabase.co/photo.png" });
  });
  open(`/user/contributions/${saved.id}/edit`);
  await fillForm({ addPhoto: false });
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Revised title" } });
  fireEvent.click(screen.getByRole("button", { name: "Resubmit for review" }));
  await screen.findByText(/Your Trace is awaiting a reviewer/);
  expect(screen.getByRole("heading", { name: "Revised title" })).toBeTruthy();
  expect(calls.mock.calls.filter(([, options]) => ["POST", "PUT"].includes(options.method)).map(([url]) => url)).toEqual([`/api/traces/${saved.id}`, submitPath]);
  expect(JSON.parse(calls.mock.calls.find(([url]) => url === submitPath)[1].body)).toEqual({ version: 5 });
});


it("saves only draft details even when a photo is selected", async () => {
  const calls = flowSetup();
  open("/user/traces/upload");
  await fillForm();
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await screen.findByRole("link", { name: "Edit draft" });
  expect(screen.getByText("No photos attached yet.")).toBeTruthy();
  expect(calls.mock.calls.filter(([, options]) => options.method === "POST").map(([url]) => url)).toEqual(["/api/traces"]);
});
