import React from "react";
import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { MemoryRouter } from "./router.jsx";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";

const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const totals = { id: "staff-id", role: "moderator", as_of: "2026-11-06T04:00:00Z", pending: 5, flagged_comments: 1, open_reports: 3, reviewed_today: 2 };
function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname + location.search}</output>; }
function setup(path) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "test-access", refresh_token: "test-refresh", expires_at: Date.now() / 1000 + 3600 }));
  const fetcher = vi.fn(async (url) => {
    if (url === "/api/auth/me") return ok({ id: "staff-id", display_name: "Test Reviewer", role: "moderator", email: "staff@example.test", status: "active" });
    if (url === "/api/dashboard") return ok(totals);
    return ok([]);
  });
  vi.stubGlobal("fetch", fetcher);
  render(<MemoryRouter initialEntries={[path]}><App /><Location /></MemoryRouter>);
  return fetcher;
}
const where = () => screen.getByTestId("location").textContent;
const mainNav = async () => within(await screen.findByRole("navigation", { name: "Main navigation" }));

it("shows three moderator tabs, with the bell and account menu kept", async () => {
  setup("/moderator/dashboard");
  await screen.findByText(/Magandang umaga, Test Reviewer/);
  const nav = await mainNav();
  expect([...nav.getAllByRole("link")].map((link) => link.textContent.trim()).filter((text) => text !== "TideTrace")).toEqual(["Dashboard", "Review", "Analytics"]);
  for (const name of ["Review Traces", "Comments", "Reports"]) expect(nav.queryByRole("link", { name })).toBeNull();
  expect(screen.getByRole("button", { name: "Account menu" })).toBeTruthy();
  expect(screen.getByRole("button", { name: /^Notifications/ })).toBeTruthy();
});

it.each(["/moderator/review", "/moderator/reports", "/moderator/review/history", "/moderator/review/trace-1"])("marks Review as the current tab on %s", async (path) => {
  setup(path);
  const nav = await mainNav();
  await waitFor(() => expect(nav.getByRole("link", { name: "Review" }).getAttribute("aria-current")).toBe("page"));
});

it("reaches Reports and My decisions from inside Review", async () => {
  setup("/moderator/review");
  const views = await screen.findByRole("navigation", { name: "Review views" });
  expect(within(views).getByRole("link", { name: "Queue" }).getAttribute("aria-current")).toBe("page");
  expect(await screen.findByRole("link", { name: "My decisions" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "My decisions" }).getAttribute("href")).toBe("/moderator/review/history");
  fireEvent.click(await within(views).findByRole("link", { name: "Reports (3)" }));
  await waitFor(() => expect(where()).toBe("/moderator/reports"));
});

it.each(["/moderator/review/history", "/moderator/reports", "/moderator/reports?type=comment", "/moderator/analytics", "/moderator/profile", "/moderator/notifications"])("keeps the moderator address %s working", async (path) => {
  setup(path);
  await mainNav();
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(where()).toBe(path);
});
