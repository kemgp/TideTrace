import React, { StrictMode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "./router.jsx";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";
import { sampleTide } from "../src/data/sampleTide.js";

const id = "50000000-0000-4000-8000-000000000001";
const imageId = "0a1b2c3d-0000-4000-8000-00000000abcd";
const stamp = "2026-10-25T00:00:00.000Z";
const detail = `/api/admin/tides/${id}`;
const ok = (data, status = 200) => ({ ok: true, status, json: async () => ({ data }) });
const fail = (status, code = "FAILED", message = "Not available.") => ({ ok: false, status, json: async () => ({ error: { code, message } }) });
const lesson = (extra = {}) => ({ ...sampleTide, id, status: "draft", updated_at: stamp, paged: false, slides_path: null, ...extra });

function setup(handler = () => undefined) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "access", refresh_token: "refresh", expires_at: Date.now() / 1000 + 3600 }));
  const calls = vi.fn(async (url, options = {}) => {
    if (url === "/api/auth/me") return ok({ id: "me", display_name: "Admin", role: "admin", status: "active" });
    return (await handler(url, options)) || ok([]);
  });
  vi.stubGlobal("fetch", calls);
  return calls;
}
const open = (path) => render(<StrictMode><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></StrictMode>);
const textFile = (text, name = "lesson.md", type = "text/markdown") => new File([text], name, { type });
const pngFile = () => new File([new Uint8Array([137, 80, 78, 71])], "shore.png", { type: "image/png" });
beforeEach(() => { sessionStorage.clear(); });

it("saves the Show in chapters choice with the lesson and does not look edited when nothing changed", async () => {
  const calls = setup((url, options) => {
    if (url === detail && options.method === "PUT") return ok(lesson({ ...JSON.parse(options.body), updated_at: "2026-10-25T00:00:01.000Z" }));
    if (url === detail) return ok(lesson());
  });
  open(`/admin/tides/${id}/edit`);
  const box = await screen.findByLabelText("Show in chapters");
  expect(box.checked).toBe(false);
  fireEvent.click(box);
  expect(box.checked).toBe(true);
  fireEvent.click(await screen.findByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(calls.mock.calls.some(([, options]) => options?.method === "PUT")).toBe(true));
  const put = calls.mock.calls.find(([, options]) => options?.method === "PUT");
  expect(JSON.parse(put[1].body).paged).toBe(true);
});

it("fills the content from a text file and asks before replacing existing content", async () => {
  setup((url) => url === detail ? ok(lesson({ body: "Existing text" })) : undefined);
  open(`/admin/tides/${id}/edit`);
  const body = await screen.findByLabelText("Lesson content");
  const input = screen.getByLabelText("Import from a file (.txt or .md)");
  fireEvent.change(input, { target: { files: [textFile("# Tides\r\nFirst\r\n## Part\r\nSecond")] } });
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Replace the current content with lesson.md?");
  expect(body.value).toBe("Existing text");
  fireEvent.click(within(alert).getByRole("button", { name: "Cancel" }));
  expect(body.value).toBe("Existing text");
  fireEvent.change(input, { target: { files: [textFile("# Tides\r\nFirst\r\n## Part\r\nSecond")] } });
  fireEvent.click(within(await screen.findByRole("alert")).getByRole("button", { name: "Replace" }));
  await waitFor(() => expect(body.value).toBe("## Tides\nFirst\n### Part\nSecond"));
});

it("imports straight into empty content and refuses other file types", async () => {
  setup();
  open("/admin/tides/new");
  const body = await screen.findByLabelText("Lesson content");
  const input = screen.getByLabelText("Import from a file (.txt or .md)");
  fireEvent.change(input, { target: { files: [textFile("Plain text", "notes.txt", "text/plain")] } });
  await waitFor(() => expect(body.value).toBe("Plain text"));
  fireEvent.change(input, { target: { files: [textFile("x", "notes.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")] } });
  expect((await screen.findByRole("alert")).textContent).toMatch(/\.txt|\.md/);
});

it("adds an image with a description, places it in the text at the cursor, and lists it", async () => {
  let listed = [];
  const calls = setup((url, options) => {
    if (url === detail) return ok(lesson({ body: "Before\n\nAfter" }));
    if (url === `/api/tides/${id}/images` && !options.method) return ok(listed);
    if (url.startsWith(`/api/tides/${id}/images?alt=`) && options.method === "POST") {
      listed = [{ id: imageId, alt: "A shore at low tide", url: "https://files.example.test/a.png" }];
      return ok({ id: imageId, tide_id: id, alt: "A shore at low tide" }, 201);
    }
  });
  open(`/admin/tides/${id}/edit`);
  const body = await screen.findByLabelText("Lesson content");
  body.focus(); body.setSelectionRange(6, 6);
  const add = await screen.findByRole("button", { name: "Add image" });
  expect(add.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Image file"), { target: { files: [pngFile()] } });
  expect(add.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Description for screen readers"), { target: { value: "A shore at low tide" } });
  fireEvent.click(add);
  await waitFor(() => expect(body.value).toContain(`![A shore at low tide](image:${imageId})`));
  expect(body.value.startsWith("Before")).toBe(true);
  expect(body.value.trimEnd().endsWith("After")).toBe(true);
  const post = calls.mock.calls.find(([, options]) => options?.method === "POST");
  expect(post[0]).toBe(`/api/tides/${id}/images?alt=A%20shore%20at%20low%20tide`);
  expect(await screen.findByRole("button", { name: "Delete image: A shore at low tide" })).toBeTruthy();
});

it("deleting an image also removes its line from the text", async () => {
  let listed = [{ id: imageId, alt: "A shore at low tide", url: null }];
  const calls = setup((url, options) => {
    if (url === detail) return ok(lesson({ body: `Before\n\n![A shore at low tide](image:${imageId})\n\nAfter` }));
    if (url === `/api/tides/${id}/images` && !options.method) return ok(listed);
    if (url === `/api/tides/${id}/images/${imageId}` && options.method === "DELETE") { listed = []; return { ok: true, status: 204, json: async () => ({}) }; }
  });
  open(`/admin/tides/${id}/edit`);
  const body = await screen.findByLabelText("Lesson content");
  fireEvent.click(await screen.findByRole("button", { name: "Delete image: A shore at low tide" }));
  await waitFor(() => expect(body.value).not.toContain("image:"));
  expect(body.value).toContain("Before");
  expect(body.value).toContain("After");
  expect(calls.mock.calls.some(([url, options]) => options?.method === "DELETE" && url.endsWith(`/images/${imageId}`))).toBe(true);
});

it("shows the server's message when an image upload fails, and leaves the text alone", async () => {
  setup((url, options) => {
    if (url === detail) return ok(lesson({ body: "Keep me" }));
    if (url.startsWith(`/api/tides/${id}/images?alt=`) && options.method === "POST") return fail(415, "UNSUPPORTED_MEDIA_TYPE", "The file is not a supported image.");
  });
  open(`/admin/tides/${id}/edit`);
  const body = await screen.findByLabelText("Lesson content");
  fireEvent.change(await screen.findByLabelText("Image file"), { target: { files: [pngFile()] } });
  fireEvent.change(screen.getByLabelText("Description for screen readers"), { target: { value: "Shore" } });
  fireEvent.click(screen.getByRole("button", { name: "Add image" }));
  expect((await screen.findByRole("alert")).textContent).toContain("The file is not a supported image.");
  expect(body.value).toBe("Keep me");
});

it("asks to save a new lesson before images can be added", async () => {
  setup();
  open("/admin/tides/new");
  await screen.findByLabelText("Lesson content");
  expect(screen.getByText("Save the lesson once to add images to its text.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Add image" })).toBeNull();
});
