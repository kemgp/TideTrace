import React, { StrictMode } from "react";
import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "./router.jsx";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";

const traceId = "20000000-0000-4000-8000-000000000001";
const ledgerId = "40000000-0000-4000-8000-000000000001";
const awardsPath = `/api/moderation/energy/awards?trace_ids=${traceId}`;
const flagPath = `/api/moderation/energy/awards/${ledgerId}/flags`;
const profile = { id: "current-user", display_name: "Actual Reviewer", email: "mod@example.test", status: "active", role: "moderator" };
const response = (data, status = 200) => ({ ok: true, status, json: async () => ({ data }) });
const failure = (status, code, message) => ({ ok: false, status, json: async () => ({ error: { code, message } }) });
const category = { id: "30000000-0000-4000-8000-000000000001", name: "Seagrass" };
const trace = (overrides = {}) => ({ id: traceId, title: "Reef survey", description: "Saved description", author_id: "member-author", category_id: category.id, category,
  author: { id: "member-author", display_name: "Member" }, location_name: "Real coast", status: "approved", version: 4, deleted_at: "2026-09-25T12:00:00Z", created_at: "2026-09-22T12:00:00Z", ...overrides });
const historyRow = (overrides = {}) => ({ id: "audit-1", trace_id: traceId, trace: { title: "Reef survey" }, actor: { display_name: "Actual Reviewer" }, action: "review_trace", to_state: "approved", reason: "Verified evidence", created_at: "2026-09-24T12:00:00Z", ...overrides });
const award = (overrides = {}) => ({ trace_id: traceId, ledger_id: ledgerId, amount: 20, reversed: false, open_flag: false, my_flags: [], ...overrides });

function setup(handler, { role = "moderator", flag = true } = {}) {
  if (flag) vi.stubEnv("VITE_ENERGY_ENABLED", "true");
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "live-access", refresh_token: "refresh", expires_at: Math.floor(Date.now() / 1000) + 3600 }));
  const calls = vi.fn(async (url, options) => {
    if (url === "/api/auth/me") return response({ ...profile, role });
    const custom = await handler(url, options);
    if (custom) return custom;
    return response([]);
  });
  vi.stubGlobal("fetch", calls);
  return calls;
}
const open = (path) => render(<StrictMode><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></StrictMode>);
const history = (url) => url.startsWith("/api/moderation/history?") ? response([historyRow()]) : undefined;
// StrictMode runs effects twice, so compare the distinct award URLs instead of counting requests.
const awardUrls = (calls) => [...new Set(calls.mock.calls.map(([url]) => url).filter((url) => url.startsWith("/api/moderation/energy/awards?")))];

it("shows the award on My decisions and reads awards once for the approved Traces on the page", async () => {
  const calls = setup((url) => history(url) || (url.startsWith("/api/moderation/energy/awards?") ? response({ active: true, awards: [award()] }) : undefined));
  open("/moderator/review/history");
  await screen.findByText("Award issued: 20 Tide Energy");
  expect(screen.getByRole("button", { name: "Flag award on Reef survey" })).toBeTruthy();
  expect(awardUrls(calls)).toEqual([awardsPath]);
});

it("only asks about approved Trace decisions", async () => {
  const other = historyRow({ id: "audit-2", trace_id: "20000000-0000-4000-8000-000000000002", to_state: "rejected" });
  const report = historyRow({ id: "audit-3", trace_id: null, action: "review_report", to_state: "resolved" });
  const calls = setup((url) => url.startsWith("/api/moderation/history?") ? response([historyRow(), other, report]) : url.startsWith("/api/moderation/energy/awards?") ? response({ active: true, awards: [award()] }) : undefined);
  open("/moderator/review/history");
  await screen.findByText("Award issued: 20 Tide Energy");
  expect(awardUrls(calls)).toEqual([awardsPath]);
  expect(screen.getAllByRole("button", { name: /Flag award/ })).toHaveLength(1);
});

it("needs a reason, sends the flag, then shows Flag open without offering another", async () => {
  let flagged = false;
  const calls = setup((url, options) => {
    if (url === flagPath) { flagged = true; return response({ id: "flag-1", status: "open" }, 201); }
    if (url.startsWith("/api/moderation/energy/awards?")) return response({ active: true, awards: [award({ open_flag: flagged, my_flags: flagged ? [{ id: "flag-1", status: "open", reason: "Looks copied" }] : [] })] });
    return history(url);
  });
  open("/moderator/review/history");
  fireEvent.click(await screen.findByRole("button", { name: "Flag award on Reef survey" }));
  const dialog = await screen.findByRole("dialog", { name: "Flag this award?" });
  const send = within(dialog).getByRole("button", { name: "Send flag" });
  expect(send.disabled).toBe(true);
  expect(send.className).toContain("blue");
  fireEvent.change(within(dialog).getByLabelText("Why should an admin look?"), { target: { value: "   " } });
  expect(send.disabled).toBe(true);
  fireEvent.change(within(dialog).getByLabelText("Why should an admin look?"), { target: { value: "  Looks copied  " } });
  fireEvent.click(send);
  await screen.findByText("Flag open");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByText("Flag sent. An admin will review it.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Flag award/ })).toBeNull();
  const write = calls.mock.calls.find(([url]) => url === flagPath)[1];
  expect(write.method).toBe("POST");
  expect(JSON.parse(write.body)).toEqual({ reason: "Looks copied" });
});

it("keeps the dialog open with the error next to the form when the flag is refused", async () => {
  setup((url) => url === flagPath ? failure(409, "ALREADY_EXISTS", "This record already exists.") : url.startsWith("/api/moderation/energy/awards?") ? response({ active: true, awards: [award()] }) : history(url));
  open("/moderator/review/history");
  fireEvent.click(await screen.findByRole("button", { name: "Flag award on Reef survey" }));
  const dialog = await screen.findByRole("dialog", { name: "Flag this award?" });
  fireEvent.change(within(dialog).getByLabelText("Why should an admin look?"), { target: { value: "Looks copied" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Send flag" }));
  expect((await within(dialog).findByRole("alert")).textContent).toBe("This award already has an open flag.");
  expect(screen.getByRole("dialog", { name: "Flag this award?" })).toBeTruthy();
  expect(screen.queryByText("Flag sent. An admin will review it.")).toBeNull();
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});

it.each([
  ["energy not active", { active: false, awards: [] }, "No award yet"],
  ["energy active but no award", { active: true, awards: [] }, "No award: before activation"],
])("says why there is no award: %s", async (name, status, text) => {
  setup((url) => url.startsWith("/api/moderation/energy/awards?") ? response(status) : history(url));
  open("/moderator/review/history");
  await screen.findByText(text);
  expect(screen.queryByRole("button", { name: /Flag award/ })).toBeNull();
});

it("shows a reversed award without a flag button, and a dismissed flag with the admin's reason and a way to flag again", async () => {
  setup((url) => url.startsWith("/api/moderation/energy/awards?") ? response({ active: true, awards: [award({ reversed: true, my_flags: [{ id: "f", status: "upheld", reason: "Copied", resolution_reason: "Confirmed copy" }] })] }) : history(url));
  const view = open("/moderator/review/history");
  await screen.findByText("Award reversed: 20 Tide Energy");
  expect(screen.getByText(/Flag resolved: the award was reversed\. Admin's reason: Confirmed copy/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Flag award/ })).toBeNull();
  view.unmount();
  setup((url) => url.startsWith("/api/moderation/energy/awards?") ? response({ active: true, awards: [award({ my_flags: [{ id: "f", status: "dismissed", reason: "Copied", resolution_reason: "Original photo" }] })] }) : history(url));
  open("/moderator/review/history");
  await screen.findByText(/Flag dismissed\. Admin's reason: Original photo/);
  expect(screen.getByRole("button", { name: "Flag award on Reef survey" })).toBeTruthy();
});

it("shows a retry when award status cannot be loaded", async () => {
  let failing = true;
  setup((url) => {
    if (url.startsWith("/api/moderation/energy/awards?")) return failing ? failure(503, "FAILED", "Unavailable") : response({ active: true, awards: [award()] });
    return history(url);
  });
  open("/moderator/review/history");
  const retry = await screen.findByRole("button", { name: "Try again" });
  failing = false;
  fireEvent.click(retry);
  await screen.findByText("Award issued: 20 Tide Energy");
});

it("is hidden, and never reads awards, while the energy flag is off", async () => {
  const calls = setup((url) => history(url), { flag: false });
  open("/moderator/review/history");
  await screen.findByText("Verified evidence");
  expect(awardUrls(calls)).toHaveLength(0);
  expect(screen.queryByText(/Award issued|No award/)).toBeNull();
  expect(screen.queryByRole("button", { name: /Flag award/ })).toBeNull();
});

it("shows the award on the staff Trace detail, including a Trace its author deleted", async () => {
  setup((url) => url === `/api/moderation/traces/${traceId}` ? response(trace()) : url.startsWith("/api/moderation/energy/awards?") ? response({ active: true, awards: [award()] }) : undefined);
  open(`/moderator/review/${traceId}`);
  await screen.findByText("Deleted by the author.");
  await screen.findByText("Award issued: 20 Tide Energy");
  expect(screen.getByRole("button", { name: "Flag award on Reef survey" })).toBeTruthy();
});

it("does not offer a flag on a Trace the reviewer wrote", async () => {
  setup((url) => url === `/api/moderation/traces/${traceId}` ? response(trace({ author_id: profile.id })) : url.startsWith("/api/moderation/energy/awards?") ? response({ active: true, awards: [award()] }) : undefined);
  open(`/moderator/review/${traceId}`);
  await screen.findByText("Award issued: 20 Tide Energy");
  expect(screen.queryByRole("button", { name: /Flag award/ })).toBeNull();
});

it("does not look up awards for a Trace that is still pending", async () => {
  const calls = setup((url) => url === `/api/moderation/traces/${traceId}` ? response(trace({ status: "pending", deleted_at: null, version: 3 })) : undefined);
  open(`/moderator/review/${traceId}`);
  await waitFor(() => expect(calls.mock.calls.some(([url]) => url === `/api/moderation/traces/${traceId}`)).toBe(true));
  await screen.findByRole("button", { name: "Approve & publish" });
  expect(awardUrls(calls)).toHaveLength(0);
});

it("shows the award and the flag action on the admin history page too", async () => {
  setup((url) => url.startsWith("/api/moderation/energy/awards?") ? response({ active: true, awards: [award()] }) : history(url), { role: "admin" });
  open("/admin/review/history");
  await screen.findByRole("heading", { name: "Every decision, on record" });
  await screen.findByText("Award issued: 20 Tide Energy");
  expect(screen.getByRole("button", { name: "Flag award on Reef survey" })).toBeTruthy();
});

it("keeps the admin history page free of award lines while the energy flag is off", async () => {
  const calls = setup((url) => history(url), { role: "admin", flag: false });
  open("/admin/review/history");
  await screen.findByText("Verified evidence");
  expect(awardUrls(calls)).toHaveLength(0);
  expect(screen.queryByText(/Award issued|No award/)).toBeNull();
});
