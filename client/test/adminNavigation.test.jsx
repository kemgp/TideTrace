import React from "react";
import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { MemoryRouter } from "./router.jsx";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";

const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const totals = { id: "admin-test", role: "admin", as_of: "2026-11-06T04:00:00Z", users: 20, active_users: 18, moderators: 3, published_traces: 40, published_tides: 6, pending: 7, open_reports: 4, held_traces: 1, oldest_pending_at: null };
function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname + location.search}</output>; }
function setup(path) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "test-access", refresh_token: "test-refresh", expires_at: Date.now() / 1000 + 3600 }));
  const fetcher = vi.fn(async (url) => {
    if (url === "/api/auth/me") return ok({ id: "admin-test", display_name: "Test Admin", role: "admin", email: "admin@example.test", status: "active" });
    if (url === "/api/dashboard") return ok(totals);
    return ok([]);
  });
  vi.stubGlobal("fetch", fetcher);
  render(<MemoryRouter initialEntries={[path]}><App /><Location /></MemoryRouter>);
  return fetcher;
}
const where = () => screen.getByTestId("location").textContent;
const mainNav = async () => within(await screen.findByRole("navigation", { name: "Main navigation" }));
const tabs = (nav) => [...nav.getAllByRole("link")].map((link) => link.textContent.trim()).filter((text) => text !== "TideTrace");

it("shows five admin tabs and no separate Users, Moderators, History, Settings or Analytics tabs", async () => {
  setup("/admin/dashboard");
  await screen.findByText(/Welcome, Test Admin/);
  const nav = await mainNav();
  expect(tabs(nav)).toEqual(["Dashboard", "Review", "People", "Content", "Insights"]);
  for (const name of ["Users", "Moderators", "History", "Settings", "Analytics", "Reports"]) expect(nav.queryByRole("link", { name })).toBeNull();
  expect(nav.getByRole("link", { name: "Review" }).getAttribute("href")).toBe("/admin/review");
  expect(nav.getByRole("link", { name: "People" }).getAttribute("href")).toBe("/admin/users");
  expect(nav.getByRole("link", { name: "Content" }).getAttribute("href")).toBe("/admin/tides");
  expect(nav.getByRole("link", { name: "Insights" }).getAttribute("href")).toBe("/admin/analytics");
});

it("puts Platform settings in the account menu next to Change profile, and the old address still works", async () => {
  setup("/admin/dashboard");
  await screen.findByText(/Welcome, Test Admin/);
  fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
  const panel = document.getElementById("account-menu-panel");
  expect(panel.contains(screen.getByRole("button", { name: "Change profile" }))).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Platform settings" }));
  await waitFor(() => expect(where()).toBe("/admin/settings"));
  await screen.findByRole("heading", { name: "Platform configuration" });
});

it.each([
  ["/admin/dashboard", "Dashboard"], ["/admin/review", "Review"], ["/admin/reports", "Review"], ["/admin/review/trace-1", "Review"],
  ["/admin/users", "People"], ["/admin/moderators", "People"], ["/admin/tides", "Content"], ["/admin/categories", "Content"],
  ["/admin/analytics", "Insights"], ["/admin/review/history", "Insights"],
])("marks the right tab as current on %s", async (path, tab) => {
  setup(path);
  const nav = await mainNav();
  await waitFor(() => expect(nav.getByRole("link", { name: tab }).getAttribute("aria-current")).toBe("page"));
  expect(nav.getAllByRole("link").filter((link) => link.getAttribute("aria-current") === "page")).toHaveLength(1);
});

it("does not mark a tab as current on the settings page", async () => {
  setup("/admin/settings");
  const nav = await mainNav();
  await screen.findByRole("heading", { name: "Platform configuration" });
  expect(nav.getAllByRole("link").some((link) => link.getAttribute("aria-current") === "page")).toBe(false);
});

it.each(["/admin/dashboard", "/admin/review", "/admin/reports", "/admin/users", "/admin/moderators", "/admin/moderators?add=1", "/admin/tides", "/admin/tides/new", "/admin/categories", "/admin/review/history", "/admin/settings", "/admin/settings?tab=logs", "/admin/analytics", "/admin/profile", "/admin/notifications"])("keeps the old address %s working without redirecting", async (path) => {
  setup(path);
  await mainNav();
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(where()).toBe(path);
});

it("switches between the Queue and Reports inside Review, with the open-reports count", async () => {
  setup("/admin/review");
  const views = await screen.findByRole("navigation", { name: "Review views" });
  expect(within(views).getByRole("link", { name: "Queue" }).getAttribute("aria-current")).toBe("page");
  const reports = await within(views).findByRole("link", { name: "Reports (4)" });
  expect(reports.getAttribute("href")).toBe("/admin/reports");
  fireEvent.click(reports);
  await waitFor(() => expect(where()).toBe("/admin/reports"));
  const again = await screen.findByRole("navigation", { name: "Review views" });
  expect(within(again).getByRole("link", { name: /^Reports/ }).getAttribute("aria-current")).toBe("page");
  fireEvent.click(within(again).getByRole("link", { name: "Queue" }));
  await waitFor(() => expect(where()).toBe("/admin/review"));
});

it("switches between Users and Moderators and keeps ?add=1 working", async () => {
  setup("/admin/users");
  const people = await screen.findByRole("navigation", { name: "People views" });
  expect(within(people).getByRole("link", { name: "Users" }).getAttribute("aria-current")).toBe("page");
  fireEvent.click(within(people).getByRole("link", { name: "Moderators" }));
  await waitFor(() => expect(where()).toBe("/admin/moderators"));
  await screen.findByRole("button", { name: "Add moderator" });
  fireEvent.click(screen.getByRole("button", { name: "Add moderator" }));
  await waitFor(() => expect(where()).toBe("/admin/moderators?add=1"));
  await screen.findByRole("button", { name: "Back to moderators" });
  expect(within(screen.getByRole("navigation", { name: "People views" })).getByRole("link", { name: "Moderators" }).getAttribute("aria-current")).toBe("page");
});

it("switches between Analytics and History inside Insights", async () => {
  setup("/admin/analytics");
  const insights = await screen.findByRole("navigation", { name: "Insights views" });
  expect(within(insights).getByRole("link", { name: "Analytics" }).getAttribute("aria-current")).toBe("page");
  fireEvent.click(within(insights).getByRole("link", { name: "History" }));
  await waitFor(() => expect(where()).toBe("/admin/review/history"));
  await screen.findByRole("heading", { name: "Every decision, on record" });
  expect(within(screen.getByRole("navigation", { name: "Insights views" })).getByRole("link", { name: "History" }).getAttribute("aria-current")).toBe("page");
});
