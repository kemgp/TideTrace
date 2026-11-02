import React, { StrictMode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "./router.jsx";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";
import { PAGE_SIZE } from "../src/api/pagination.js";
const id = "20000000-0000-4000-8000-000000000001";
const comment = (n = 0, author_id = "me") => ({ id: `comment-${n}`, author_id, body: `Observation ${n}`, created_at: "2026-10-25T00:00:00Z" });
const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
beforeEach(() => Object.defineProperties(HTMLDialogElement.prototype, {
  showModal: { configurable: true, value() { this.open = true; } },
  close: { configurable: true, value() { this.open = false; } },
}));
function setup({ rows = [comment()], remove = () => ({ ok: true, status: 204 }) } = {}) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "access", refresh_token: "refresh", expires_at: Date.now() / 1000 + 3600 }));
  const fetch = vi.fn(async (url, options) => {
    if (url === "/api/auth/me") return ok({ id: "me", display_name: "Member", role: "user", status: "active" });
    if (options.method === "DELETE") return remove();
    if (url === `/api/traces/${id}`) return ok({ id, author_id: "other", title: "Coast", status: "approved", trace_media: [] });
    if (url.includes("/comments?")) { const offset = Number(new URL(url, "http://x").searchParams.get("offset")); return ok(rows.slice(offset, offset + PAGE_SIZE)); }
    return ok([]);
  });
  vi.stubGlobal("fetch", fetch);
  render(<StrictMode><MemoryRouter initialEntries={[`/user/traces/${id}`]}><App /></MemoryRouter></StrictMode>);
  return fetch;
}
async function open() {
  const trigger = await screen.findByRole("button", { name: "Delete comment" });
  trigger.focus(); fireEvent.click(trigger);
  return screen.getByRole("dialog", { name: "Delete this comment?" });
}
it("only offers deletion for own comments", async () => {
  setup({ rows: [comment(), comment(1, "other")] });
  await screen.findByText("Observation 1");
  expect(screen.getAllByRole("button", { name: "Delete comment" })).toHaveLength(1);
});
it("Cancel and Escape restore focus without a request", async () => {
  const fetch = setup();
  let modal = await open();
  const trigger = screen.getByRole("button", { name: "Delete comment" });
  expect(document.activeElement).toBe(within(modal).getByRole("button", { name: "Cancel" }));
  fireEvent.click(within(modal).getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).toBeNull(); expect(document.activeElement).toBe(trigger);
  modal = await open(); fireEvent(modal, new Event("cancel", { bubbles: true, cancelable: true }));
  expect(screen.queryByRole("dialog")).toBeNull(); expect(document.activeElement).toBe(trigger);
  expect(fetch.mock.calls.some(([, o]) => o.method === "DELETE")).toBe(false);
});
it.each([204, 404])("removes the only comment, focuses the heading and toasts once for %s", async (status) => {
  const fetch = setup({ remove: () => status === 204 ? { ok: true, status } : { ok: false, status, json: async () => ({ error: { message: "Gone" } }) } });
  const modal = await open(); fireEvent.click(within(modal).getByRole("button", { name: "Delete", exact: true }));
  await waitFor(() => expect(screen.queryByText("Observation 0")).toBeNull());
  expect(await screen.findAllByText(status === 204 ? "Comment deleted." : "This comment no longer exists.")).toHaveLength(1);
  expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Comments (0)" }));
  expect(screen.getByText("No comments yet. Be the first to say something.")).toBeTruthy();
  expect(fetch.mock.calls.filter(([url, o]) => url === "/api/comments/comment-0" && o.method === "DELETE")).toHaveLength(1);
});
it("guards double submission and leaves server failures inline", async () => {
  let finish;
  const fetch = setup({ remove: () => new Promise((resolve) => { finish = resolve; }) });
  const modal = await open(); const button = within(modal).getByRole("button", { name: "Delete", exact: true });
  fireEvent.click(button); fireEvent.click(button);
  await waitFor(() => expect(finish).toBeTruthy());
  expect(fetch.mock.calls.filter(([, o]) => o.method === "DELETE")).toHaveLength(1);
  await act(async () => finish({ ok: false, status: 502, json: async () => ({ error: { message: "Try again." } }) }));
  expect(await within(modal).findByRole("alert")).toHaveProperty("textContent", "Try again.");
  expect(screen.getByText("Observation 0")).toBeTruthy(); expect(button.disabled).toBe(false);
});
it("keeps Show more working after deleting from a full page", async () => {
  setup({ rows: Array.from({ length: PAGE_SIZE + 1 }, (_, n) => comment(n, n === 0 ? "me" : "other")) });
  const modal = await open(); fireEvent.click(within(modal).getByRole("button", { name: "Delete", exact: true }));
  await waitFor(() => expect(screen.queryByText("Observation 0")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Show more comments" }));
  expect(await screen.findByText(`Observation ${PAGE_SIZE}`)).toBeTruthy();
});

it("shows which comment is being deleted, shortened when long", async () => {
  setup({ rows: [{ ...comment(), body: "x".repeat(200) }] });
  const modal = await open();
  const quote = modal.querySelector(".comment-delete-preview");
  expect(quote.textContent.startsWith("“xxxx")).toBe(true);
  expect(quote.textContent.endsWith("…”")).toBe(true);
  expect(quote.textContent.length).toBeLessThan(150);
});
