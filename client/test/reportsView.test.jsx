import React from "react";
import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { MemoryRouter } from "./router.jsx";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";

const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const trace = { id: "20000000-0000-4000-8000-000000000001", title: "Coastal observation", description: "Observed plastic waste", status: "approved", author_id: "other", trace_media: [] };
const traceReport = { id: "70000000-0000-4000-8000-000000000001", trace_id: trace.id, comment_id: null, reason: "Private information", status: "open", trace, reporter: { display_name: "Member" } };
const commentReport = { id: "70000000-0000-4000-8000-000000000002", trace_id: null, comment_id: "60000000-0000-4000-8000-000000000001", reason: "Rude comment", status: "open", trace: null, comment: { id: "60000000-0000-4000-8000-000000000001", body: "Reported comment", status: "visible", author: { display_name: "Commenter" }, trace }, reporter: { display_name: "Member" } };

function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname + location.search}</output>; }
function setup(path, role = "moderator") {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "test-access", refresh_token: "test-refresh", expires_at: Date.now() / 1000 + 3600 }));
  const fetcher = vi.fn(async (url) => {
    if (url === "/api/auth/me") return ok({ id: "staff-id", display_name: "Test Staff", role, email: "staff@example.test", status: "active" });
    if (url.startsWith("/api/moderation/reports?")) {
      const type = new URL(url, "http://localhost").searchParams.get("type");
      return ok(type === "trace" ? [traceReport] : type === "comment" ? [commentReport] : [traceReport, commentReport]);
    }
    return ok([]);
  });
  vi.stubGlobal("fetch", fetcher);
  render(<MemoryRouter initialEntries={[path]}><App /><Location /></MemoryRouter>);
  return fetcher;
}
const reportCalls = (fetcher) => fetcher.mock.calls.map(([url]) => url).filter((url) => url.startsWith("/api/moderation/reports?"));

it("redirects the old moderator comments page to the Reports view with the Comments filter", async () => {
  const fetcher = setup("/moderator/comments");
  await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/moderator/reports?type=comment"));
  expect(await screen.findByRole("button", { name: "Comments" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Comments" }).getAttribute("aria-pressed")).toBe("true");
  await screen.findByText("Reported comment", { exact: false });
  expect(reportCalls(fetcher).every((url) => url.includes("type=comment"))).toBe(true);
});

it("sends a member who opens the old comments address to their own home, not to reports", async () => {
  setup("/moderator/comments", "user");
  await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/user/dashboard"));
});

it("shows Traces and comments together under All and sends no type", async () => {
  const fetcher = setup("/admin/reports", "admin");
  expect(await screen.findAllByRole("article", { name: "Report: Coastal observation" })).toHaveLength(2);
  expect(screen.getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: "Dismiss report" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Keep comment" })).toBeTruthy();
  expect(reportCalls(fetcher)[0]).not.toContain("type=");
});

it("filters by Traces and Comments, asks the server for that type and keeps it in the URL", async () => {
  const fetcher = setup("/admin/reports", "admin");
  const type = await screen.findByRole("group", { name: "Report type" });
  fireEvent.click(within(type).getByRole("button", { name: "Traces" }));
  await waitFor(() => expect(reportCalls(fetcher).some((url) => url.includes("status=open") && url.includes("type=trace"))).toBe(true));
  expect(screen.getByTestId("location").textContent).toBe("/admin/reports?type=trace");
  expect(within(type).getByRole("button", { name: "Traces" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(within(type).getByRole("button", { name: "Comments" }));
  await waitFor(() => expect(reportCalls(fetcher).some((url) => url.includes("type=comment"))).toBe(true));
  expect(screen.getByTestId("location").textContent).toBe("/admin/reports?type=comment");
  // The type stays when the status changes.
  fireEvent.click(within(screen.getByRole("group", { name: "Report status" })).getByRole("button", { name: /^Dismissed/ }));
  await waitFor(() => expect(reportCalls(fetcher).some((url) => url.includes("status=dismissed") && url.includes("type=comment"))).toBe(true));
  fireEvent.click(within(type).getByRole("button", { name: "All" }));
  await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/admin/reports"));
  await waitFor(() => expect(reportCalls(fetcher).some((url) => url.includes("status=dismissed") && !url.includes("type="))).toBe(true));
});

it("opens with the filter from the address and ignores an unknown type", async () => {
  const fetcher = setup("/moderator/reports?type=trace");
  await screen.findByRole("article", { name: "Report: Coastal observation" });
  expect(screen.getByRole("button", { name: "Traces" }).getAttribute("aria-pressed")).toBe("true");
  expect(reportCalls(fetcher)[0]).toContain("type=trace");
});

it("treats an unknown type as All", async () => {
  const fetcher = setup("/moderator/reports?type=banana");
  await screen.findByRole("article", { name: "Report: Coastal observation" });
  expect(screen.getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe("true");
  expect(reportCalls(fetcher)[0]).not.toContain("type=");
});
