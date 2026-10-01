import React from "react";
import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";

const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
function setup(path, role = "moderator") {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "test-access", refresh_token: "test-refresh", expires_at: Date.now() / 1000 + 3600 }));
  const fetcher = vi.fn(async (url) => {
    if (url === "/api/auth/me") return ok({ id: "staff-id", display_name: "Test Reviewer", email: "staff@example.test", role, status: "active" });
    if (url.startsWith("/api/moderation/traces?")) return ok([
      { id: "reef", title: "Reef survey", status: "pending", category: { name: "Coral condition" }, author: { display_name: "Ana" }, location_name: "Coast", created_at: "2026-09-27T00:00:00Z" },
      { id: "grass", title: "Seagrass survey", status: "pending", category: { name: "Seagrass" }, author: { display_name: "Ben" }, location_name: "Pier", created_at: "2026-09-27T00:00:00Z" },
    ]);
    return ok([]);
  });
  vi.stubGlobal("fetch", fetcher);
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
  return fetcher;
}

it("filters the saved queue by category while preserving review links", async () => {
  setup("/moderator/review");
  await screen.findByRole("heading", { name: "Reef survey" });
  fireEvent.click(screen.getByRole("button", { name: "Coral" }));
  expect(within(screen.getByRole("heading", { name: "Reef survey" }).closest("article")).getByRole("link", { name: "Review" }).getAttribute("href")).toBe("/moderator/review/reef");
  expect(screen.queryByRole("heading", { name: "Seagrass survey" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Fisheries" }));
  expect(screen.getByText("No pending submissions on this page.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "All" }));
  expect(within(screen.getByRole("heading", { name: "Seagrass survey" }).closest("article")).getByRole("link", { name: "Review" })).toBeTruthy();
});

it("navigates to moderator analytics and identifies sample data", async () => {
  setup("/moderator/dashboard");
  await screen.findByText(/Magandang umaga, Test Reviewer/);
  fireEvent.click(screen.getByRole("link", { name: "Analytics" }));
  await screen.findByRole("heading", { name: "Moderation analytics" });
  expect(screen.getByText(/Demo analytics from sample data/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Analytics" }).getAttribute("aria-current")).toBe("page");
});

it("keeps comment demo actions in the session and makes outcomes visible", async () => {
  const fetcher = setup("/moderator/comments");
  await screen.findByRole("heading", { name: "Flagged comments" });
  const comment = screen.getByRole("article", { name: "Comment by Guest_204" });
  fireEvent.click(within(comment).getByRole("button", { name: "Keep comment" }));
  expect(screen.queryByRole("article", { name: "Comment by Guest_204" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Kept" }));
  expect(screen.getByRole("article", { name: "Comment by Guest_204" })).toBeTruthy();
  expect(fetcher.mock.calls.every(([, options]) => !options?.method || options.method === "GET")).toBe(true);
});

it("loads the saved report status selected by each tab", async () => {
  const fetcher = setup("/moderator/reports");
  await screen.findByText("No open reports on this page.");
  fireEvent.click(screen.getByRole("button", { name: "Dismissed" }));
  await screen.findByText("No dismissed reports on this page.");
  expect(fetcher.mock.calls.some(([url]) => url.includes("reports?status=dismissed"))).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Removed" }));
  await screen.findByText("No resolved reports on this page.");
  expect(fetcher.mock.calls.some(([url]) => url.includes("reports?status=resolved"))).toBe(true);
});

it("prevents a member from opening moderator analytics", async () => {
  setup("/moderator/analytics", "user");
  await screen.findByText(/Kumusta/);
  expect(screen.queryByRole("heading", { name: "Moderation analytics" })).toBeNull();
});
