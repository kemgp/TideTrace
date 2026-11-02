import React, { StrictMode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "./router.jsx";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";

const traceId = "20000000-0000-4000-8000-000000000001";
const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const base = { id: traceId, title: "Coastal observation", description: "Observed plastic waste", status: "approved", author_id: "other",
  author: { id: "other", display_name: "Other Member" }, category: { id: "c", name: "Pollution" }, location_name: "Esplanade",
  published_at: "2026-10-24T00:00:00Z", latitude: null, longitude: null, trace_media: [] };

function setup(trace = base) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "access", refresh_token: "refresh", expires_at: Date.now() / 1000 + 3600 }));
  vi.stubGlobal("fetch", vi.fn(async (url) => {
    if (url === "/api/auth/me") return ok({ id: "current-user", display_name: "Test member", status: "active", role: "user" });
    if (url === `/api/traces/${traceId}`) return ok(trace);
    if (url.startsWith("/api/media/")) return ok({ url: "https://example.test/photo.jpg", expires_in: 60 });
    return ok([]);
  }));
}
const open = () => render(<StrictMode><MemoryRouter initialEntries={[`/user/traces/${traceId}`]}><App /></MemoryRouter></StrictMode>);

beforeEach(() => { sessionStorage.clear(); });

it("groups location, facts and actions in a details panel beside the story", async () => {
  setup();
  open();
  const aside = await screen.findByRole("complementary", { name: "Trace details" });
  expect(within(aside).getByRole("heading", { name: "Location" })).toBeTruthy();
  expect(within(aside).getByRole("heading", { name: "About this trace" })).toBeTruthy();
  expect(within(aside).getByText("Category").closest("div").textContent).toContain("Pollution");
  expect(within(aside).getByRole("button", { name: "Report Trace", exact: true })).toBeTruthy();
  expect(within(aside).queryByRole("button", { name: "Delete", exact: true })).toBeNull();
});

it("shows the owner's Delete in the panel instead of Report", async () => {
  setup({ ...base, author_id: "current-user", author: { id: "current-user", display_name: "Test member" } });
  open();
  const aside = await screen.findByRole("complementary", { name: "Trace details" });
  expect(await within(aside).findByRole("button", { name: "Delete", exact: true })).toBeTruthy();
  expect(within(aside).queryByRole("button", { name: "Report Trace", exact: true })).toBeNull();
});

it("explains a withheld location instead of drawing a map", async () => {
  setup({ ...base, is_sensitive: true });
  open();
  const aside = await screen.findByRole("complementary", { name: "Trace details" });
  expect(within(aside).getByText("Location withheld")).toBeTruthy();
  expect(within(aside).getByText("Hidden to protect this site.")).toBeTruthy();
});

it("shows who posted and when in words, with the full date available", async () => {
  setup();
  open();
  const heading = await screen.findByRole("heading", { name: "Coastal observation" });
  const meta = heading.parentElement;
  expect(within(meta).getByText("Other Member")).toBeTruthy();
  const time = meta.querySelector("time");
  expect(time.getAttribute("title")).toMatch(/2026/);
  expect(time.getAttribute("datetime")).toBe("2026-10-24T00:00:00.000Z");
});

it("offers a larger view of the photo", async () => {
  setup({ ...base, trace_media: [{ id: "m1", mime_type: "image/jpeg", object_path: "other/trace/photo.jpg", sort_order: 0 }] });
  open();
  fireEvent.click(await screen.findByRole("button", { name: "View photo 1 larger" }));
  const viewer = document.querySelector(".photo-viewer");
  expect(viewer).toBeTruthy();
  fireEvent.click(within(viewer).getByRole("button", { name: "Close", hidden: true }));
  expect(document.querySelector(".photo-viewer")).toBeNull();
});
