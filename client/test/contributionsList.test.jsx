import React, { StrictMode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { MemoryRouter } from "./router.jsx";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";

const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const row = (id, status, extra = {}) => ({ id, title: `Trace ${id}`, author_id: "me", status, category: { id: "c", name: "Pollution" },
  location_name: "Coast", description: "x", created_at: "2026-10-20T00:00:00Z", updated_at: "2026-10-24T00:00:00Z", trace_media: [], version: 1, ...extra });
function Where() { const location = useLocation(); return <output data-testid="url">{location.pathname}{location.search}</output>; }
function setup(rows, path = "/user/contributions") {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "access", refresh_token: "refresh", expires_at: Date.now() / 1000 + 3600 }));
  const fetch = vi.fn(async (url, options = {}) => {
    if (url === "/api/auth/me") return ok({ id: "me", display_name: "Member", role: "user", status: "active", data_saver: true });
    if (options.method === "POST" && url === "/api/contributions/photo-cleanup") return { ok: true, status: 204 };
    if (url.startsWith("/api/contributions?")) return ok(typeof rows === "function" ? rows(url) : rows);
    return ok([]);
  });
  vi.stubGlobal("fetch", fetch);
  render(<StrictMode><MemoryRouter initialEntries={[path]}><Where /><App /></MemoryRouter></StrictMode>);
  return fetch;
}
const url = () => screen.getByTestId("url").textContent;
beforeEach(() => { sessionStorage.clear(); });

it("shows where each trace stands and how recently it changed", async () => {
  setup([row("d", "draft"), row("p", "pending"), row("a", "approved")]);
  await screen.findByText("Trace d");
  expect(screen.getByText("Not submitted yet")).toBeTruthy();
  expect(screen.getByText("Waiting for a reviewer")).toBeTruthy();
  expect(screen.getByText("Published")).toBeTruthy();
  expect(document.querySelectorAll(".contrib-state time").length).toBe(3);
});

it("opens a draft in the editor and everything else on the trace page", async () => {
  setup([row("d", "draft"), row("r", "revision_requested"), row("a", "approved"), row("p", "pending")]);
  await screen.findByText("Trace d");
  const href = (title) => screen.getByText(title).closest("a").getAttribute("href");
  expect(href("Trace d")).toBe("/user/contributions/d/edit");
  expect(href("Trace r")).toBe("/user/contributions/r");
  expect(href("Trace a")).toBe("/user/contributions/a");
  expect(href("Trace p")).toBe("/user/contributions/p");
  expect(screen.getAllByText("Continue editing")).toHaveLength(1);
  expect(screen.queryByRole("link", { name: "Edit and resubmit" })).toBeNull();
});

it("keeps Delete as a quiet button outside the row link", async () => {
  setup([row("d", "draft")]);
  const button = await screen.findByRole("button", { name: "Delete", exact: true });
  expect(button.classList.contains("contrib-delete")).toBe(true);
  expect(button.closest("a")).toBeNull();
});

it("keeps the status filter and page in the URL", async () => {
  setup((request) => request.includes("status=draft") ? [row("d", "draft")] : Array.from({ length: 6 }, (_, i) => row(`all${i}`, "approved")));
  await screen.findByText("Trace all0");
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  expect(url()).toBe("/user/contributions?page=2");
  fireEvent.click(screen.getByRole("button", { name: "Draft" }));
  expect(url()).toBe("/user/contributions?status=draft");
  await screen.findByText("Trace d");
});

it("opens the bookmarked status and page", async () => {
  const fetch = setup([row("d", "draft")], "/user/contributions?status=draft&page=2");
  await waitFor(() => expect(fetch.mock.calls.some(([path]) => path === "/api/contributions?limit=6&offset=6&status=draft")).toBe(true));
});

it("returns to the same filter after opening a trace", async () => {
  // A pending trace opens the trace page (a draft would open the editor instead).
  setup([row("p", "pending")], "/user/contributions?status=pending");
  fireEvent.click(await screen.findByRole("link", { name: /Trace p/ }));
  fireEvent.click(await screen.findByRole("link", { name: /Back to My Contributions/ }));
  await waitFor(() => expect(url()).toBe("/user/contributions?status=pending"));
});

it("invites a first upload when there is nothing yet", async () => {
  setup([]);
  expect(await screen.findByText("You haven't submitted any traces yet.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Upload your first trace" }).getAttribute("href")).toBe("/user/traces/upload");
});

it("explains an empty status and offers all traces", async () => {
  setup([], "/user/contributions?status=rejected");
  expect(await screen.findByText("No rejected traces.")).toBeTruthy();
  const link = screen.getByRole("link", { name: "Show all traces" });
  expect(link.getAttribute("href")).toBe("/user/contributions");
});
