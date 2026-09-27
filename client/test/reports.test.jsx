import React, { StrictMode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";

const traceId = "20000000-0000-4000-8000-000000000001";
const commentId = "60000000-0000-4000-8000-000000000001";
const id = "70000000-0000-4000-8000-000000000001";
const trace = { id: traceId, title: "Coastal observation", description: "Observed plastic waste", status: "approved", author_id: "other", trace_media: [] };
const initial = { id, trace_id: traceId, comment_id: null, reason: "Private information", status: "open", trace, reporter: { display_name: "Member" } };
const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const fail = (status = 503, code = "FAILED") => ({ ok: false, status, json: async () => ({ error: { code, message: "Unable to save." } }) });
function setup(handler = () => undefined, role = "user") {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "live-access", refresh_token: "refresh", expires_at: Date.now() / 1000 + 3600 }));
  const fetch = vi.fn(async (url, options) => {
    if (url === "/api/auth/me") return ok({ id: "current-user", display_name: "Test member", status: "active", role });
    const response = await handler(url, options);
    if (response) return response;
    if (url === `/api/traces/${traceId}`) return ok(trace);
    if (url.startsWith(`/api/traces/${traceId}/comments?`)) return ok([{ id: commentId, trace_id: traceId, body: "Please review this comment", author_id: "other" }]);
    if (url.startsWith("/api/moderation/reports?")) return ok([initial]);
    return ok([]);
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
const open = (path) => render(<StrictMode><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></StrictMode>);
const writes = (calls) => calls.mock.calls.filter(([, options]) => options.method === "POST");
async function click(name) {
  const button = await screen.findByRole("button", { name, exact: true });
  await waitFor(() => expect(button.disabled || button.closest("fieldset")?.disabled || false).toBe(false));
  fireEvent.click(button);
}

it.each(["Trace", "comment"])("reports a %s with an inline required reason and correct target", async (type) => {
  const field = type === "Trace" ? "trace_id" : "comment_id";
  const target = type === "Trace" ? traceId : commentId;
  const calls = setup((url, options) => url === "/api/reports" ? ok({ id, reporter_id: "current-user", ...JSON.parse(options.body) }) : undefined);
  open(`/user/traces/${traceId}`);
  await click(`Report ${type}`);
  await click("Submit report");
  await screen.findByText("Enter a reason for this report.");
  expect(writes(calls)).toHaveLength(0);
  fireEvent.change(screen.getByLabelText("Reason for report"), { target: { value: " Needs review " } });
  await click("Submit report");
  await screen.findByText("Report submitted for review.");
  expect(JSON.parse(writes(calls)[0][1].body)).toEqual({ [field]: target, reason: "Needs review" });
});

it("handles a duplicate report without claiming a new save", async () => {
  setup((url) => url === "/api/reports" ? fail(409, "ALREADY_EXISTS") : undefined);
  open(`/user/traces/${traceId}`);
  await click("Report Trace");
  fireEvent.change(screen.getByLabelText("Reason for report"), { target: { value: "Review" } });
  await click("Submit report");
  await screen.findByText("You already have an open report for this content.");
  expect(screen.queryByText("Report submitted for review.")).toBeNull();
});

it("checks an uncertain report without automatically sending it again", async () => {
  const calls = setup((url) => {
    if (url === "/api/reports") throw new TypeError("Lost response");
    if (url.startsWith("/api/reports?")) return ok([{ id, trace_id: traceId, reporter_id: "current-user", status: "open" }]);
  });
  open(`/user/traces/${traceId}`);
  await click("Report Trace");
  fireEvent.change(screen.getByLabelText("Reason for report"), { target: { value: "Review" } });
  await click("Submit report");
  await screen.findByRole("button", { name: "Check saved report" });
  expect(screen.getByRole("button", { name: "Submit report" }).disabled).toBe(true);
  await click("Check saved report");
  await screen.findByText("Your report is saved and awaiting review.");
  expect(writes(calls)).toHaveLength(1);
});

it.each([false, true])("saves moderator decision remove=%s and reloads its saved reason", async (remove) => {
  const calls = setup((url, options) => {
    if (url.endsWith("/resolve")) return { ok: true, status: 204 };
    if (url === `/api/moderation/reports/${id}`) return ok({ ...initial, status: remove ? "resolved" : "dismissed", resolution_reason: "Reviewed evidence" });
  }, "moderator");
  open("/moderator/reports");
  await screen.findByText("Private information", { exact: false });
  await click(remove ? "Remove content" : "Dismiss report");
  await screen.findByText("Enter a reason for your decision.");
  fireEvent.change(screen.getByLabelText("Decision reason"), { target: { value: "Reviewed evidence" } });
  await click(remove ? "Remove content" : "Dismiss report");
  await screen.findByText(remove ? "Content removed. Decision saved." : "Report dismissed. Decision saved.");
  expect(screen.queryByRole("button", { name: "Remove content" })).toBeNull();
  expect(JSON.parse(writes(calls)[0][1].body)).toEqual({ remove_content: remove, reason: "Reviewed evidence" });
});

it("blocks uncertain moderation writes until the saved report is reloaded", async () => {
  const calls = setup((url) => url.endsWith("/resolve") ? fail() : url === `/api/moderation/reports/${id}` ? ok({ ...initial, status: "dismissed", resolution_reason: "Handled by another moderator" }) : undefined, "moderator");
  open("/moderator/reports");
  fireEvent.change(await screen.findByLabelText("Decision reason"), { target: { value: "Reviewed" } });
  await click("Dismiss report");
  await screen.findByRole("button", { name: "Reload saved report" });
  expect(screen.getByLabelText("Decision reason").closest("fieldset").disabled).toBe(true);
  await click("Reload saved report");
  await screen.findByText("Handled by another moderator", { exact: false });
  expect(writes(calls)).toHaveLength(1);
});

it("shows resolved comment reports, safe content, and supports admin access", async () => {
  const calls = setup((url) => url.startsWith("/api/moderation/reports?") ? ok(url.includes("status=open") ? [] : [{ ...initial, trace_id: null, trace: null, comment_id: commentId, comment: { body: "<script>unsafe()</script>", trace: { title: "Comment context" }, status: "hidden" }, status: "resolved", resolution_reason: "Removed harassment" }]) : undefined, "admin");
  open("/admin/reports");
  await screen.findByText("No open reports on this page.");
  fireEvent.change(screen.getByLabelText("Report status"), { target: { value: "resolved" } });
  await screen.findByText("Comment: Comment context");
  expect(screen.getByText("<script>unsafe()</script>").querySelector("script")).toBeNull();
  expect(screen.queryByLabelText("Decision reason")).toBeNull();
  expect(calls.mock.calls.some(([url]) => url.includes("status=resolved&limit=25&offset=0"))).toBe(true);
});

it("does not request moderator reports for an ordinary member", async () => {
  const calls = setup();
  open("/moderator/reports");
  await screen.findByText(/Kumusta/);
  expect(calls.mock.calls.some(([url]) => url.startsWith("/api/moderation/reports"))).toBe(false);
});

it("prevents duplicate decisions and ignores a late response after logout", async () => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const calls = setup((url) => url.endsWith("/resolve") ? pending : undefined, "moderator");
  open("/moderator/reports");
  fireEvent.change(await screen.findByLabelText("Decision reason"), { target: { value: "Reviewed" } });
  const button = screen.getByRole("button", { name: "Dismiss report" });
  fireEvent.click(button); fireEvent.click(button);
  await waitFor(() => expect(writes(calls)).toHaveLength(1));
  await click("Log out");
  await screen.findByRole("heading", { name: "Welcome to TideTrace" });
  await act(async () => finish({ ok: true, status: 204 }));
  expect(screen.queryByText("Report dismissed. Decision saved.")).toBeNull();
});

it("retries report queue failures and paginates without inventing an empty state", async () => {
  let works = false;
  const calls = setup((url) => {
    if (url.startsWith("/api/moderation/reports?")) return works ? ok(url.endsWith("offset=25") ? [] : Array.from({ length: 25 }, (_, index) => ({ ...initial, id: `${id}-${index}` }))) : fail();
  }, "moderator");
  open("/moderator/reports");
  await screen.findByRole("alert");
  expect(screen.queryByText("No open reports on this page.")).toBeNull();
  works = true;
  await click("Try again");
  await screen.findAllByLabelText("Decision reason");
  await click("Next page");
  await screen.findByText("No open reports on this page.");
  expect(calls.mock.calls.some(([url]) => url.endsWith("status=open&limit=25&offset=25"))).toBe(true);
});

it("blocks duplicate member reports and ignores the save after logout", async () => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const calls = setup((url) => url === "/api/reports" ? pending : undefined);
  open(`/user/traces/${traceId}`);
  await click("Report Trace");
  fireEvent.change(screen.getByLabelText("Reason for report"), { target: { value: "Review" } });
  const button = screen.getByRole("button", { name: "Submit report" });
  fireEvent.click(button); fireEvent.click(button);
  await waitFor(() => expect(writes(calls)).toHaveLength(1));
  await click("Log out");
  await screen.findByRole("heading", { name: "Welcome to TideTrace" });
  await act(async () => finish(ok({ id, trace_id: traceId, reporter_id: "current-user" })));
  expect(screen.queryByText("Report submitted for review.")).toBeNull();
});
