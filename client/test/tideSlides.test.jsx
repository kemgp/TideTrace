import React, { StrictMode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "./router.jsx";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";

const rendered = [];
const destroyed = vi.fn();
const countPdfPages = vi.fn(async () => 7);
const openPdf = vi.fn(async () => ({
  pages: 5,
  render: async (number) => { rendered.push(number); return { promise: Promise.resolve(), cancel() {} }; },
  destroy: destroyed,
}));
vi.mock("../src/api/pdfDocument.js", () => ({ openPdf: (...args) => openPdf(...args), countPdfPages: (...args) => countPdfPages(...args) }));

const id = "50000000-0000-4000-8000-000000000001";
const topic = "60000000-0000-4000-8000-000000000001";
const stamp = "2026-10-01T00:00:00.000Z";
const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const fail = (status, code = "FAILED") => ({ ok: false, status, json: async () => ({ error: { code, message: "Not available." } }) });
const slidesLesson = (extra = {}) => ({ id, title: "Reading the shoreline", slug: "reading-the-shoreline", body: "Text version of the slides.", status: "published", published_at: stamp, updated_at: stamp, slides_path: `${id}/slides-a.pdf`, slides_pages: 5, ...extra });

function setup(handler = () => undefined, role = "user") {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "access", refresh_token: "refresh", expires_at: Date.now() / 1000 + 3600 }));
  const calls = vi.fn(async (url, options = {}) => {
    if (url === "/api/auth/me") return ok({ id: "me", display_name: "Member", role, status: "active" });
    return (await handler(url, options)) || ok([]);
  });
  vi.stubGlobal("fetch", calls);
  return calls;
}
const open = (path) => render(<StrictMode><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></StrictMode>);
beforeEach(() => { sessionStorage.clear(); rendered.length = 0; openPdf.mockClear(); destroyed.mockClear(); countPdfPages.mockClear(); });

const lessonApi = (tide, slides = ok({ url: "https://files.example.test/slides.pdf?token=t", expires_in: 600, pages: 5 })) => (url) => {
  if (url === `/api/tides/${id}`) return ok(tide);
  if (url === `/api/tides/${id}/slides`) return slides;
  if (url === `/api/tides/${id}/neighbors`) return ok({ id, previous: null, next: null });
};

it("flips through PDF slides with buttons and the keyboard, and keeps the text version", async () => {
  setup(lessonApi(slidesLesson()));
  open(`/user/tides/${id}`);
  const viewer = await screen.findByRole("region", { name: "Lesson slides" });
  await within(viewer).findByText("Slide 1 of 5");
  expect(openPdf).toHaveBeenCalledWith("https://files.example.test/slides.pdf?token=t");
  const previous = within(viewer).getByRole("button", { name: "Previous slide" });
  expect(previous.disabled).toBe(true);
  fireEvent.click(within(viewer).getByRole("button", { name: "Next slide" }));
  await within(viewer).findByText("Slide 2 of 5");
  fireEvent.keyDown(viewer, { key: "ArrowRight" });
  await within(viewer).findByText("Slide 3 of 5");
  fireEvent.keyDown(viewer, { key: "ArrowLeft" });
  await within(viewer).findByText("Slide 2 of 5");
  fireEvent.keyDown(viewer, { key: "End" });
  await within(viewer).findByText("Slide 5 of 5");
  expect(within(viewer).getByRole("button", { name: "Next slide" }).disabled).toBe(true);
  expect(within(viewer).getByRole("progressbar", { name: "Slide progress" }).getAttribute("aria-valuenow")).toBe("5");
  fireEvent.keyDown(viewer, { key: "Home" });
  await within(viewer).findByText("Slide 1 of 5");
  expect(within(viewer).getByRole("img", { name: "Slide 1 of 5" })).toBeTruthy();
  await waitFor(() => expect(rendered).toContain(5));
  expect(screen.getByText("Text version of the slides.")).toBeTruthy();
  expect(screen.getAllByRole("heading", { level: 2, name: "Reading the shoreline" })).toHaveLength(1);
});

it("makes the top progress bar follow the slides", async () => {
  setup(lessonApi(slidesLesson()));
  open(`/user/tides/${id}`);
  const viewer = await screen.findByRole("region", { name: "Lesson slides" });
  const bar = () => document.querySelector(".reading-progress span").style.transform;
  await waitFor(() => expect(bar()).toBe("scaleX(0.2)"));
  fireEvent.click(within(viewer).getByRole("button", { name: "Next slide" }));
  await waitFor(() => expect(bar()).toBe("scaleX(0.4)"));
  fireEvent.keyDown(viewer, { key: "End" });
  await waitFor(() => expect(bar()).toBe("scaleX(1)"));
});

it("tells members to read the text version when the slides cannot be loaded", async () => {
  setup(lessonApi(slidesLesson(), fail(404, "NOT_FOUND")));
  open(`/user/tides/${id}`);
  expect((await screen.findByText(/The slides are not available/)).getAttribute("role")).toBe("alert");
  expect(screen.getByText("Text version of the slides.")).toBeTruthy();
  expect(openPdf).not.toHaveBeenCalled();
});

it("shows an error when the PDF cannot be opened", async () => {
  openPdf.mockRejectedValueOnce(new Error("bad pdf"));
  setup(lessonApi(slidesLesson()));
  open(`/user/tides/${id}`);
  expect(await screen.findByText("The slides could not be loaded.")).toBeTruthy();
});

it("does not request slides for a lesson without any", async () => {
  const calls = setup(lessonApi(slidesLesson({ slides_path: null, slides_pages: null })));
  open(`/user/tides/${id}`);
  await screen.findByRole("article", { name: "Lesson content" });
  expect(screen.queryByRole("region", { name: "Lesson slides" })).toBeNull();
  expect(calls.mock.calls.some(([url]) => String(url).endsWith("/slides"))).toBe(false);
});

it("filters the library by topic, search and progress, and goes back to page one", async () => {
  const urls = [];
  setup((url) => {
    if (url.startsWith("/api/tides?")) { urls.push(url); return ok([{ id, title: "Tide pools", body: "Body", summary: "Short summary for the card", category: { id: topic, name: "Shoreline" }, status: "published" }]); }
    if (url === "/api/categories") return ok([{ id: topic, name: "Shoreline" }]);
  });
  open("/user/tides");
  expect(await screen.findByText("Short summary for the card")).toBeTruthy();
  expect(urls[0]).toBe("/api/tides?limit=6&offset=0");
  expect(screen.getAllByText("Shoreline").length).toBeGreaterThan(0);
  fireEvent.click(await screen.findByRole("button", { name: "Shoreline", pressed: false }));
  await waitFor(() => expect(urls.at(-1)).toBe(`/api/tides?limit=6&offset=0&category_id=${topic}`));
  fireEvent.click(screen.getByRole("button", { name: "Completed" }));
  await waitFor(() => expect(urls.at(-1)).toContain("progress=completed"));
  fireEvent.change(screen.getByRole("textbox", { name: "Search lessons" }), { target: { value: "  tide pool " } });
  await waitFor(() => expect(urls.at(-1)).toContain("q=tide+pool"), { timeout: 2000 });
  expect(urls.at(-1)).toContain("offset=0");
});

it("explains an empty filtered library and can clear the filters", async () => {
  const urls = [];
  setup((url) => {
    if (url.startsWith("/api/tides?")) { urls.push(url); return ok(url.includes("progress=") ? [] : [{ id, title: "Tide pools", body: "Body", status: "published" }]); }
  });
  open("/user/tides");
  await screen.findByText("Tide pools");
  fireEvent.click(screen.getByRole("button", { name: "Completed" }));
  expect(await screen.findByText("No lessons match these filters.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  await screen.findByText("Tide pools");
  expect(urls.at(-1)).toBe("/api/tides?limit=6&offset=0");
});

const adminLesson = (extra = {}) => ({ id, title: "Reading the shoreline", slug: "reading-the-shoreline", body: "Body", summary: "", category_id: null, status: "draft", updated_at: stamp, cover_path: null, slides_path: null, slides_pages: null, ...extra });
const pdf = () => new File([new Uint8Array(20)], "lesson.pdf", { type: "application/pdf" });

it("saves the summary and topic, and uploads slides with the page count", async () => {
  let current = adminLesson();
  const calls = setup((url, options) => {
    if (url === "/api/categories") return ok([{ id: topic, name: "Shoreline" }]);
    if (url === `/api/tides/${id}/slides?pages=7` && options.method === "POST") { current = adminLesson({ slides_path: `${id}/slides-a.pdf`, slides_pages: 7, updated_at: "2026-10-01T00:00:05.000Z" }); return ok(current); }
    if (url === `/api/tides/${id}/slides` && options.method === "DELETE") { current = adminLesson({ updated_at: "2026-10-01T00:00:06.000Z" }); return ok(current); }
    if (url === `/api/admin/tides/${id}` && options.method === "PUT") { const { updated_at, ...body } = JSON.parse(options.body); current = adminLesson({ ...body, updated_at: "2026-10-01T00:00:09.000Z" }); return ok(current); }
    if (url === `/api/admin/tides/${id}`) return ok(current);
  }, "admin");
  open(`/admin/tides/${id}/edit`);
  const summary = await screen.findByLabelText("Summary");
  fireEvent.change(summary, { target: { value: "A short summary" } });
  await waitFor(() => expect(screen.getByRole("option", { name: "Shoreline" })).toBeTruthy());
  fireEvent.change(screen.getByLabelText("Topic"), { target: { value: topic } });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await screen.findByText("Lesson saved as draft");
  const put = calls.mock.calls.find(([, options]) => options?.method === "PUT");
  expect(JSON.parse(put[1].body)).toMatchObject({ summary: "A short summary", category_id: topic });
  fireEvent.change(screen.getByLabelText("Slides (PDF)"), { target: { files: [pdf()] } });
  await screen.findByText("Slides uploaded · 7 pages");
  expect(countPdfPages).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("Lesson content (text version of the slides)")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Remove slides" }));
  await screen.findByLabelText("Slides (PDF)");
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(calls.mock.calls.filter(([, options]) => options?.method === "PUT")).toHaveLength(2));
  expect(JSON.parse(calls.mock.calls.filter(([, options]) => options?.method === "PUT")[1][1].body).updated_at).toBe("2026-10-01T00:00:06.000Z");
});

it("rejects the wrong file type and oversized files before uploading", async () => {
  const calls = setup((url) => {
    if (url === `/api/admin/tides/${id}`) return ok(adminLesson());
  }, "admin");
  open(`/admin/tides/${id}/edit`);
  const slides = await screen.findByLabelText("Slides (PDF)");
  fireEvent.change(slides, { target: { files: [new File(["x"], "slides.pptx", { type: "application/vnd.ms-powerpoint" })] } });
  expect((await screen.findByRole("alert")).textContent).toContain("Choose a PDF");
  const big = new File([new Uint8Array(1)], "cover.png", { type: "image/png" });
  Object.defineProperty(big, "size", { value: 6 * 1024 * 1024 });
  fireEvent.change(screen.getByLabelText("Cover image"), { target: { files: [big] } });
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("too large"));
  expect(calls.mock.calls.some(([url, options]) => options?.method === "POST")).toBe(false);
});

it("shows a PDF that cannot be read and does not upload it", async () => {
  countPdfPages.mockRejectedValueOnce(new Error("corrupt"));
  const calls = setup((url) => url === `/api/admin/tides/${id}` ? ok(adminLesson()) : undefined, "admin");
  open(`/admin/tides/${id}/edit`);
  fireEvent.change(await screen.findByLabelText("Slides (PDF)"), { target: { files: [pdf()] } });
  expect((await screen.findByRole("alert")).textContent).toContain("could not be read");
  expect(calls.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
});

it("keeps slides chosen on a new lesson and uploads them right after the first save", async () => {
  let created;
  const calls = setup((url, options) => {
    if (url === "/api/admin/tides" && options.method === "POST") { const { updated_at, ...body } = JSON.parse(options.body); created = adminLesson({ ...body }); return ok(created); }
    if (url === `/api/tides/${id}/slides?pages=7` && options.method === "POST") return ok(adminLesson({ slides_path: `${id}/slides-a.pdf`, slides_pages: 7 }));
    if (url === `/api/admin/tides/${id}`) return ok(created);
  }, "admin");
  open("/admin/tides/new");
  fireEvent.change(await screen.findByLabelText("Lesson title"), { target: { value: "Reading the shoreline" } });
  fireEvent.change(screen.getByLabelText("Lesson content"), { target: { value: "Body" } });
  fireEvent.change(screen.getByLabelText("Slides (PDF)"), { target: { files: [pdf()] } });
  await screen.findByText("lesson.pdf · 7 pages");
  expect(calls.mock.calls.some(([url]) => String(url).includes("/slides"))).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(calls.mock.calls.some(([url, options]) => url === `/api/tides/${id}/slides?pages=7` && options.method === "POST")).toBe(true));
  expect(calls.mock.calls.findIndex(([url]) => url === "/api/admin/tides")).toBeLessThan(calls.mock.calls.findIndex(([url]) => String(url).includes("/slides?pages=7")));
  await screen.findByRole("heading", { name: "Edit lesson" });
});

it("saves a new lesson even when the chosen file then fails to upload", async () => {
  const calls = setup((url, options) => {
    if (url === "/api/admin/tides" && options.method === "POST") { const { updated_at, ...body } = JSON.parse(options.body); return ok(adminLesson({ ...body })); }
    if (String(url).includes("/slides?pages=")) return fail(503);
    if (url === `/api/admin/tides/${id}`) return ok(adminLesson());
  }, "admin");
  open("/admin/tides/new");
  fireEvent.change(await screen.findByLabelText("Lesson title"), { target: { value: "Reading the shoreline" } });
  fireEvent.change(screen.getByLabelText("Slides (PDF)"), { target: { files: [pdf()] } });
  await screen.findByText(/lesson\.pdf · 7 pages/);
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  expect(await screen.findByText(/The lesson was saved, but the slides could not be uploaded/)).toBeTruthy();
  await screen.findByRole("heading", { name: "Edit lesson" });
  expect(calls.mock.calls.filter(([url, options]) => url === "/api/admin/tides" && options.method === "POST")).toHaveLength(1);
});
