import React, { StrictMode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "./router.jsx";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";
import { PAGE_SIZE } from "../src/api/pagination.js";

const traceId = "20000000-0000-4000-8000-000000000001";
const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const photo = (id, order) => ({ id, mime_type: "image/jpeg", object_path: `other/trace/${id}.jpg`, sort_order: order });
const base = { id: traceId, title: "Coastal observation", description: "Observed plastic waste", status: "approved", author_id: "other",
  author: { id: "other", display_name: "Other Member" }, category: { id: "c", name: "Pollution" }, location_name: "Esplanade",
  published_at: "2026-10-24T00:00:00Z", latitude: 10.7, longitude: 122.5, trace_media: [] };
const comment = (index) => ({ id: `c${index}`, trace_id: traceId, body: `Comment number ${index}`, author_id: "other", created_at: "2026-10-25T00:00:00Z", author: { id: "other", display_name: "Other Member" } });

function setup({ trace = base, comments = () => [] } = {}) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "access", refresh_token: "refresh", expires_at: Date.now() / 1000 + 3600 }));
  const fetch = vi.fn(async (url) => {
    if (url === "/api/auth/me") return ok({ id: "current-user", display_name: "Test member", status: "active", role: "user" });
    if (url === `/api/traces/${traceId}`) return ok(trace);
    if (url.startsWith(`/api/traces/${traceId}/comments?`)) return ok(comments(Number(new URL(url, "http://x").searchParams.get("offset"))));
    const media = url.match(/^\/api\/media\/([^/]+)\/url$/);
    if (media) return ok({ url: `https://example.test/${media[1]}.jpg`, expires_in: 60 });
    return ok([]);
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
const open = () => render(<StrictMode><MemoryRouter initialEntries={[`/user/traces/${traceId}`]}><App /></MemoryRouter></StrictMode>);
const twoPhotos = { ...base, trace_media: [photo("m1", 0), photo("m2", 1)] };

beforeEach(() => { sessionStorage.clear(); });

it("lets a thumbnail become the main photo", async () => {
  setup({ trace: twoPhotos });
  open();
  fireEvent.click(await screen.findByRole("button", { name: "Show photo 2" }));
  expect(await screen.findByRole("button", { name: "View photo 2 larger" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Show photo 1" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "View photo 1 larger" })).toBeNull();
});

it("steps through photos in the viewer with buttons and arrow keys", async () => {
  setup({ trace: twoPhotos });
  open();
  await waitFor(() => expect(document.querySelectorAll(".trace-detail__media-item img").length).toBe(2));
  fireEvent.click(await screen.findByRole("button", { name: "View photo 1 larger" }));
  const viewer = document.querySelector(".photo-viewer");
  expect(within(viewer).getByText("1 of 2")).toBeTruthy();
  fireEvent.click(within(viewer).getByRole("button", { name: "Next photo", hidden: true }));
  expect(within(viewer).getByText("2 of 2")).toBeTruthy();
  expect(within(viewer).getByAltText("Coastal observation, photo 2")).toBeTruthy();
  fireEvent.keyDown(viewer, { key: "ArrowLeft" });
  expect(within(viewer).getByText("1 of 2")).toBeTruthy();
  fireEvent.keyDown(viewer, { key: "ArrowRight" });
  expect(within(viewer).getByText("2 of 2")).toBeTruthy();
});

it("links to the pin in Maps and copies the page address with its own confirmation", async () => {
  setup();
  const writeText = vi.fn().mockResolvedValue();
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  open();
  const link = await screen.findByRole("link", { name: /Open in Maps/ });
  expect(link.getAttribute("href")).toContain("query=10.7%2C122.5");
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toContain("noopener");
  fireEvent.click(screen.getByRole("button", { name: "More actions" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Copy link" }));
  expect(await screen.findByRole("menuitem", { name: "Link copied" })).toBeTruthy();
  expect(writeText).toHaveBeenCalledWith(window.location.href);
});

it("reports from a dialog that can be cancelled", async () => {
  setup();
  open();
  fireEvent.click(await screen.findByRole("button", { name: "More actions" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "Report trace" }));
  expect(screen.queryByRole("menu")).toBeNull();
  const dialog = await screen.findByRole("dialog", { name: "Report this trace" });
  expect(within(dialog).getByLabelText("Reason for report")).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog", { name: "Report this trace" })).toBeNull();
});

it("shows more comments in one growing thread", async () => {
  const total = PAGE_SIZE + 1;
  setup({ comments: (offset) => Array.from({ length: Math.min(PAGE_SIZE, total - offset) }, (_, index) => comment(offset + index)) });
  open();
  await screen.findByText("Comment number 0");
  expect(screen.getByText(`Comments (${PAGE_SIZE}+)`)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Show more comments" }));
  await screen.findByText(`Comment number ${PAGE_SIZE}`);
  expect(screen.getByText("Comment number 0")).toBeTruthy();
  expect(screen.getByText(`Comments (${total})`)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Show more comments" })).toBeNull();
});

it("shows how many characters are left only near the limit", async () => {
  setup();
  open();
  const box = await screen.findByRole("textbox", { name: "Add a comment" });
  expect(screen.queryByText(/characters left/)).toBeNull();
  fireEvent.change(box, { target: { value: "a".repeat(4600) } });
  expect(screen.getByText("400 characters left")).toBeTruthy();
});
