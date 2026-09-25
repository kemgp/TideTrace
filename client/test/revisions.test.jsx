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
const revision = (fields = {}) => trace({ status: "revision_requested", version: 4, trace_media: [photo], ...fields });
const detail = `/api/contributions/${trace().id}`;
const reviews = `${detail}/reviews?limit=25&offset=0`;
const update = `/api/traces/${trace().id}`;
const feedback = { id: "review-id", to_state: "revision_requested", from_state: "pending", reason: "Please identify the shoreline and add clearer evidence.", created_at: "2026-09-24T12:00:00Z" };
function revisionSetup(handler) {
  return setup((url, options) => {
    const custom = handler(url, options);
    if (custom) return custom;
    if (url.includes("/reviews?")) return response([feedback]);
    if (url.endsWith("/url")) return response({ url: "https://project.supabase.co/photo.png" });
  });
}

it("shows feedback, saves edits under the same Trace, then resubmits and locks editing", async () => {
  let saved = revision();
  const calls = revisionSetup((url, options) => {
    if (url === detail) return response(saved);
    if (url.startsWith("/api/contributions?")) return response([saved]);
    if (url === update && options.method === "PUT") { saved = { ...saved, ...JSON.parse(options.body), version: saved.version + 1 }; return response(saved); }
    if (url === `${update}/submit`) { saved = { ...saved, status: "pending", version: saved.version + 1 }; return response(saved); }
  });
  open(`/user/contributions/${saved.id}`);
  await screen.findByText(feedback.reason);
  fireEvent.click(screen.getByRole("link", { name: "Edit requested revision" }));
  await screen.findByRole("heading", { name: "Edit requested revision" });
  await screen.findByText(feedback.reason);
  await screen.findByRole("option", { name: "Seagrass" });
  fireEvent.change(screen.getByLabelText("Location"), { target: { value: "Lawis north shoreline" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByRole("link", { name: "Edit requested revision" });
  expect(screen.getByText("Needs revision")).toBeTruthy();
  expect(screen.getByText("Lawis north shoreline")).toBeTruthy();
  expect(calls.mock.calls.some(([url]) => url === `${update}/submit`)).toBe(false);
  const submit = screen.getByRole("button", { name: "Resubmit for review" });
  await waitFor(() => expect(submit.disabled).toBe(false));
  fireEvent.click(submit);
  await screen.findByText(/Your Trace is awaiting a reviewer/);
  expect(screen.queryByRole("link", { name: "Edit requested revision" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Upload photo" })).toBeNull();
  expect(calls.mock.calls.some(([url]) => url === "/api/traces")).toBe(false);
  expect(JSON.parse(calls.mock.calls.find(([url, options]) => url === update && options.method === "PUT")[1].body).version).toBe(4);
  expect(JSON.parse(calls.mock.calls.find(([url]) => url === `${update}/submit`)[1].body)).toEqual({ version: 5 });
  // Reopening the saved record continues to show Pending with its previous feedback.
  fireEvent.click(screen.getByRole("link", { name: /Back to My Contributions/ }));
  fireEvent.click(await screen.findByText(saved.title));
  await screen.findByText(/Your Trace is awaiting a reviewer/);
  await screen.findByText(feedback.reason);
  expect(screen.queryByRole("link", { name: "Edit requested revision" })).toBeNull();
});

it("allows photo removal and replacement during revision and uses the updated version", async () => {
  let saved = revision();
  const calls = revisionSetup((url, options) => {
    if (url === detail) return response(saved);
    if (url === `/api/media/${photo.id}` && options.method === "DELETE") { saved = revision({ trace_media: [], version: 5 }); return { ok: true, status: 204 }; }
    if (url === `${update}/media`) { saved = revision({ version: 6 }); return response(photo); }
    if (url === `${update}/submit`) return response({ ...saved, status: "pending", version: 7 });
  });
  open(`/user/contributions/${saved.id}`);
  const initialSubmit = await screen.findByRole("button", { name: "Resubmit for review" });
  await waitFor(() => expect(initialSubmit.disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Remove photo 1" }));
  await screen.findByText("Photo removed from this draft.");
  const missingPhotoSubmit = screen.getByRole("button", { name: "Resubmit for review" });
  await waitFor(() => expect(missingPhotoSubmit.disabled).toBe(false));
  fireEvent.click(missingPhotoSubmit);
  await screen.findByText("Add at least one photo before submitting.");
  fireEvent.change(screen.getByLabelText("Choose a photo"), { target: { files: [new File([new Uint8Array(12)], "evidence.png", { type: "image/png" })] } });
  const submit = screen.getByRole("button", { name: "Resubmit for review" });
  await waitFor(() => expect(submit.disabled).toBe(false));
  fireEvent.click(submit);
  await screen.findByText(/Your Trace is awaiting a reviewer/);
  expect(JSON.parse(calls.mock.calls.find(([url]) => url === `${update}/submit`)[1].body).version).toBe(6);
});

it("does not save whitespace-only required revision fields", async () => {
  const calls = revisionSetup((url) => url === detail ? response(revision()) : undefined);
  open(`/user/contributions/${trace().id}/edit`);
  await screen.findByRole("option", { name: "Seagrass" });
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "   " } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect((await screen.findByRole("alert")).textContent).toMatch(/Enter a title/);
  expect(calls.mock.calls.some(([, options]) => options.method === "PUT")).toBe(false);
});

it("retains text and requires reload when a revision edit conflicts", async () => {
  const calls = revisionSetup((url, options) => url === detail ? response(revision()) : options.method === "PUT" ? failure(409) : undefined);
  open(`/user/contributions/${trace().id}/edit`);
  await screen.findByRole("option", { name: "Seagrass" });
  fireEvent.change(screen.getByLabelText("Description"), { target: { value: "My unsaved explanation" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect((await screen.findByRole("alert")).textContent).toMatch(/changed since you opened/);
  expect(screen.getByLabelText("Description").value).toBe("My unsaved explanation");
  expect(screen.getByRole("button", { name: "Save changes" }).disabled).toBe(true);
  expect(calls.mock.calls.filter(([, options]) => options.method === "PUT")).toHaveLength(1);
});

it("requires an explicit status check after an uncertain resubmission", async () => {
  let saved = revision();
  const calls = revisionSetup((url) => {
    if (url === detail) return response(saved);
    if (url === `${update}/submit`) { saved = { ...saved, status: "pending", version: 5 }; throw new TypeError("Lost response"); }
  });
  open(`/user/contributions/${trace().id}`);
  const submit = await screen.findByRole("button", { name: "Resubmit for review" });
  await waitFor(() => expect(submit.disabled).toBe(false));
  fireEvent.click(submit);
  expect((await screen.findByRole("alert")).textContent).toMatch(/could not confirm submission/);
  fireEvent.click(screen.getByRole("button", { name: "Reload saved Trace" }));
  await screen.findByText(/Your Trace is awaiting a reviewer/);
  expect(calls.mock.calls.filter(([url]) => url === `${update}/submit`)).toHaveLength(1);
});

it("retries feedback failures without showing fabricated notes", async () => {
  let works = false;
  revisionSetup((url) => url === detail ? response(revision()) : url === reviews ? works ? response([feedback]) : failure() : undefined);
  open(`/user/contributions/${trace().id}`);
  await screen.findByRole("alert");
  expect(screen.queryByText(feedback.reason)).toBeNull();
  works = true;
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText(feedback.reason)).toBeTruthy();
});

it("shows prior feedback to a reviewer opening a resubmitted Trace", async () => {
  revisionSetup((url) => url === `/api/moderation/traces/${trace().id}` ? response(revision({ author_id: "someone-else", status: "pending" })) : undefined);
  const fetch = globalThis.fetch;
  vi.stubGlobal("fetch", vi.fn((url, options) => url === "/api/auth/me" ? Promise.resolve(response({ ...profile, role: "moderator" })) : fetch(url, options)));
  open(`/moderator/review/${trace().id}`);
  await screen.findByRole("heading", { name: "Previous review feedback" });
  expect(await screen.findByText(feedback.reason)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Approve & publish" })).toBeTruthy();
});
