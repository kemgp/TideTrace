import React, { StrictMode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "./router.jsx";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";

const id = "50000000-0000-4000-8000-000000000001";
const prevId = "50000000-0000-4000-8000-000000000003";
const nextId = "50000000-0000-4000-8000-000000000002";
const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const body = `Opening paragraph with **bold words**.\nSecond line stays on its own line.\n\n## What to do\n- Check the shoreline\n- Take a photo\n\n<img src=x onerror="alert(1)">`;
const lesson = (extra = {}) => ({ id, title: "Reading the shoreline", slug: "reading-the-shoreline", body, status: "published", published_at: "2026-10-01T00:00:00Z", ...extra });

function setup({ neighbors = { id, previous: { id: prevId, title: "Newer lesson" }, next: { id: nextId, title: "Older lesson" } }, completed = false, tide = lesson() } = {}) {
  let done = completed;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "access", refresh_token: "refresh", expires_at: Date.now() / 1000 + 3600 }));
  vi.stubGlobal("fetch", vi.fn(async (url, options = {}) => {
    if (url === "/api/auth/me") return ok({ id: "me", display_name: "Member", role: "user", status: "active" });
    if (url === `/api/tides/${id}/completion`) { done = true; return ok({ user_id: "me", tide_id: id, completed_at: "2026-11-03T00:00:00Z" }); }
    if (url === `/api/tides/${id}/neighbors`) return ok(neighbors);
    if (url === `/api/tides/${id}`) return ok(tide);
    if (url.startsWith("/api/tide-completions")) return ok(done ? [{ tide_id: id, completed_at: "2026-11-03T00:00:00Z" }] : []);
    return ok([]);
  }));
  render(<StrictMode><MemoryRouter initialEntries={[`/user/tides/${id}`]}><App /></MemoryRouter></StrictMode>);
}
beforeEach(() => { sessionStorage.clear(); });

it("shows structure from the lesson text and keeps markup as text", async () => {
  setup();
  const article = await screen.findByRole("article", { name: "Lesson content" });
  expect(screen.getByRole("heading", { level: 2, name: "Reading the shoreline" })).toBeTruthy();
  expect(within(article).getByRole("heading", { level: 3, name: "What to do" })).toBeTruthy();
  expect(within(article).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Check the shoreline", "Take a photo"]);
  expect(within(article).getByText("bold words").tagName).toBe("STRONG");
  expect(article.querySelector("img")).toBeNull();
  expect(article.textContent).toContain('<img src=x onerror="alert(1)">');
  expect(within(article).queryByText(/min read/)).toBeNull();
});

it("links to the previous and next lessons", async () => {
  setup();
  const nav = await screen.findByRole("navigation", { name: "More lessons" });
  expect(within(nav).getByRole("link", { name: /Previous lesson/ }).getAttribute("href")).toBe(`/user/tides/${prevId}`);
  const next = within(nav).getByRole("link", { name: /Next lesson/ });
  expect(next.getAttribute("href")).toBe(`/user/tides/${nextId}`);
  expect(next.classList.contains("is-up-next")).toBe(false);
});

it("highlights the next lesson once this one is completed", async () => {
  setup();
  const button = await screen.findByRole("button", { name: "Mark as complete" });
  await waitFor(() => expect(button.disabled).toBe(false));
  fireEvent.click(button);
  const next = await screen.findByRole("link", { name: /Up next/ });
  expect(next.getAttribute("href")).toBe(`/user/tides/${nextId}`);
  expect(next.classList.contains("is-up-next")).toBe(true);
});

it("shows no navigation when the lesson stands alone", async () => {
  setup({ neighbors: { id, previous: null, next: null } });
  await screen.findByRole("article", { name: "Lesson content" });
  await waitFor(() => expect(screen.queryByRole("navigation", { name: "More lessons" })).toBeNull());
});
