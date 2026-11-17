import React, { StrictMode } from "react";
import { expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "./router.jsx";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";
import { forgetAllMedia, forgetMedia, loadMedia } from "../src/api/mediaLinks.js";
import { requestData } from "../src/api/data.js";
import { compressIfPossible } from "../src/api/compressPhoto.js";

const mediaId = "40000000-0000-4000-8000-000000000001";
const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });

it("reuses a public photo link for the session, per account, until it nears expiry", async () => {
  forgetAllMedia();
  const read = vi.fn(async () => ({ url: "https://project.supabase.co/a.png?token=1", expires_in: 3600 }));
  const first = await loadMedia({ id: mediaId, owner: "member-a", read });
  const again = await loadMedia({ id: mediaId, owner: "member-a", read });
  expect(again.url).toBe(first.url);
  expect(first.revoke).toBeNull();
  expect(read).toHaveBeenCalledTimes(1);
  await loadMedia({ id: mediaId, owner: "member-b", read });
  expect(read).toHaveBeenCalledTimes(2);
  forgetMedia("member-a", mediaId);
  await loadMedia({ id: mediaId, owner: "member-a", read });
  expect(read).toHaveBeenCalledTimes(3);
  const short = vi.fn(async () => ({ url: "https://project.supabase.co/b.png?token=2", expires_in: 30 }));
  await loadMedia({ id: "short", owner: "member-a", read: short });
  await loadMedia({ id: "short", owner: "member-a", read: short });
  expect(short).toHaveBeenCalledTimes(2);
});

it("fetches a restricted photo as a file and never remembers it", async () => {
  forgetAllMedia();
  const file = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
  const read = vi.fn(async (path, options = {}) => path.endsWith("/url") ? { url: null, private: true } : options.as === "blob" ? file : null);
  const media = await loadMedia({ id: mediaId, owner: "member-a", read });
  expect(media.url).toMatch(/^blob:/);
  expect(read).toHaveBeenLastCalledWith(`media/${mediaId}/file`, { signal: undefined, as: "blob" });
  media.revoke();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith(media.url);
  await loadMedia({ id: mediaId, owner: "member-a", read });
  expect(read).toHaveBeenCalledTimes(4);
  await expect(loadMedia({ id: "none", owner: "member-a", read: async () => ({ url: null }) })).rejects.toThrow("No photo preview was returned.");
});

it("returns API files as blobs and still reports JSON errors", async () => {
  const blob = new Blob(["bytes"], { type: "image/png" });
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, blob: async () => blob, json: async () => { throw new Error("not JSON"); } })));
  expect(await requestData(`media/${mediaId}/file`, { token: "t", as: "blob" })).toBe(blob);
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, json: async () => ({ error: { code: "NOT_FOUND", message: "Record not found." } }) })));
  await expect(requestData(`media/${mediaId}/file`, { token: "t", as: "blob" })).rejects.toThrow("Record not found.");
});

it("shows a draft's photo from a file the API sends, with no shareable link", async () => {
  forgetAllMedia();
  const profile = { id: "current-user", display_name: "Actual Member", email: "member@example.test", status: "active", role: "user" };
  const category = { id: "30000000-0000-4000-8000-000000000001", name: "Seagrass" };
  const trace = { id: "20000000-0000-4000-8000-000000000001", title: "Saved seagrass survey", description: "Saved description", author_id: profile.id, category_id: category.id, category,
    author: { id: profile.id, display_name: profile.display_name }, location_name: "Real coast", status: "draft", version: 1, created_at: "2026-09-22T12:00:00Z",
    trace_media: [{ id: mediaId, trace_id: "20000000-0000-4000-8000-000000000001", object_path: "current-user/trace/photo.png", mime_type: "image/png", size_bytes: 12, sort_order: 0 }] };
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "live-access", refresh_token: "refresh", expires_at: Math.floor(Date.now() / 1000) + 3600 }));
  const calls = vi.fn(async (url) => {
    if (url === "/api/auth/me") return ok(profile);
    if (url === `/api/contributions/${trace.id}`) return ok(trace);
    if (url === `/api/media/${mediaId}/url`) return ok({ url: null, private: true });
    if (url === `/api/media/${mediaId}/file`) return { ok: true, status: 200, blob: async () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }) };
    if (url === "/api/categories") return ok([category]);
    return ok([]);
  });
  vi.stubGlobal("fetch", calls);
  const view = render(<StrictMode><MemoryRouter initialEntries={[`/user/contributions/${trace.id}`]}><App /></MemoryRouter></StrictMode>);
  const image = await screen.findByAltText("Trace photo 1");
  expect(image.getAttribute("src")).toMatch(/^blob:tidetrace-test-/);
  const file = calls.mock.calls.find(([url]) => url === `/api/media/${mediaId}/file`);
  expect(file[1].headers.Authorization).toBe("Bearer live-access");
  view.unmount();
  await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalled());
});

it("resizes lesson images when the browser can, and uploads the original when it cannot", async () => {
  const original = new File(["x".repeat(100)], "cover.png", { type: "image/png" });
  expect(await compressIfPossible(original)).toBe(original);
  vi.stubGlobal("Image", class { naturalWidth = 3200; naturalHeight = 1600; set src(value) { queueMicrotask(() => this.onload()); } });
  HTMLCanvasElement.prototype.getContext.mockImplementation((type) => type === "2d" ? { drawImage: vi.fn() } : null);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (done) {
    expect(this.width).toBe(1600);
    done(new Blob(["small"], { type: "image/webp" }));
  });
  const prepared = await compressIfPossible(original);
  expect(prepared.type).toBe("image/webp");
  expect(prepared.name).toBe("cover.webp");
  vi.stubGlobal("Image", class { set src(value) { queueMicrotask(() => this.onerror()); } });
  expect(await compressIfPossible(original)).toBe(original);
});
