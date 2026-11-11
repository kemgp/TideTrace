import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "./router.jsx";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";

const id = "50000000-0000-4000-8000-000000000001";
const quizUrl = `/api/tides/${id}/quiz`;
const attemptsUrl = `${quizUrl}/attempts`;
const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const fail = (status, code, message, details) => ({ ok: false, status, json: async () => ({ error: { code, message, ...(details ? { details } : {}) } }) });
const lesson = { id, title: "Reading the shoreline", slug: "reading-the-shoreline", body: "Opening paragraph.", status: "published", published_at: "2026-10-01T00:00:00Z" };
const questions = (version = 1) => Array.from({ length: 5 }, (_, i) => ({ id: `q${i + 1}`, position: i + 1, prompt: `Prompt ${i + 1} v${version}?`, options: [`A${i + 1}`, `B${i + 1}`, `C${i + 1}`, `D${i + 1}`] }));
const open = (extra = {}) => ({ tide_id: id, version: 1, passed: false, retry_after: 0, questions: questions(), ...extra });
const passedQuiz = () => ({ ...open({ passed: true }), questions: questions().map((q, i) => ({ ...q, correct_index: i % 4, explanation: `Because ${i + 1}.` })) });

beforeEach(() => {
  sessionStorage.clear();
  vi.stubEnv("VITE_ENERGY_ENABLED", "true");
});
afterEach(() => vi.unstubAllEnvs());

function setup({ completed = true, quiz = () => ok(open()), attempt = () => ok({ passed: false, retry_after: 30 }), complete = () => ok({ user_id: "me", tide_id: id, completed_at: "2026-11-03T00:00:00Z" }) } = {}) {
  let done = completed;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "access", refresh_token: "refresh", expires_at: Date.now() / 1000 + 3600 }));
  const calls = vi.fn(async (url, options = {}) => {
    if (url === "/api/auth/me") return ok({ id: "me", display_name: "Member", role: "user", status: "active" });
    if (url === `/api/tides/${id}/completion`) { done = true; return complete(); }
    if (url === `/api/tides/${id}`) return ok(lesson);
    if (url === attemptsUrl) return attempt(JSON.parse(options.body));
    if (url === quizUrl) return quiz();
    if (url.startsWith("/api/tide-completions")) return ok(done ? [{ tide_id: id, completed_at: "2026-11-03T00:00:00Z" }] : []);
    return ok([]);
  });
  vi.stubGlobal("fetch", calls);
  render(<MemoryRouter initialEntries={[`/user/tides/${id}`]}><App /></MemoryRouter>);
  return calls;
}
const asked = (calls, url) => calls.mock.calls.filter(([u]) => u === url);
const attempts = (calls) => asked(calls, attemptsUrl).map(([, options]) => JSON.parse(options.body));
const answerAll = (choice = 0) => { for (let n = 1; n <= 5; n++) fireEvent.click(screen.getByRole("radio", { name: `${"ABCD"[choice]}${n}` })); };
const quizSection = () => screen.findByRole("region", { name: "Lesson quiz" });
// The quiz opens on an intro card; the questions appear after "Start quiz".
const begin = async () => { fireEvent.click(await screen.findByRole("button", { name: "Start quiz" })); return quizSection(); };

it("does not ask for a quiz while the flag is off", async () => {
  vi.stubEnv("VITE_ENERGY_ENABLED", "");
  const calls = setup();
  await screen.findByText("Completed");
  expect(asked(calls, quizUrl)).toHaveLength(0);
  expect(screen.queryByRole("region", { name: "Lesson quiz" })).toBeNull();
});

it("waits for the completion before asking for the quiz", async () => {
  const calls = setup({ completed: false });
  const button = await screen.findByRole("button", { name: "Mark as complete" });
  expect(asked(calls, quizUrl)).toHaveLength(0);
  await waitFor(() => expect(button.disabled).toBe(false));
  fireEvent.click(button);
  expect(await quizSection()).toBeTruthy();
  expect(asked(calls, quizUrl)).toHaveLength(1);
});

it("shows nothing when the lesson has no published quiz", async () => {
  const calls = setup({ quiz: () => fail(404, "NOT_FOUND", "Record not found.") });
  await screen.findByText("Completed");
  await waitFor(() => expect(asked(calls, quizUrl)).toHaveLength(1));
  expect(screen.queryByRole("region", { name: "Lesson quiz" })).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
});

it("lists the questions, counts what is left and submits the version with five answers", async () => {
  const calls = setup();
  const section = await begin();
  expect(within(section).getByText("Prompt 1 v1?", { exact: false })).toBeTruthy();
  const submit = within(section).getByRole("button", { name: "Submit answers" });
  expect(submit.disabled).toBe(true);
  expect(within(section).getByText("5 left to answer")).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: "B1" }));
  expect(within(section).getByText("4 left to answer")).toBeTruthy();
  for (let n = 2; n <= 4; n++) fireEvent.click(screen.getByRole("radio", { name: `A${n}` }));
  expect(within(section).getByText("1 left to answer")).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: "D5" }));
  expect(submit.disabled).toBe(false);
  fireEvent.click(submit);
  await screen.findByText("Not passed yet. Read the lesson again if you need to, then try again.");
  expect(attempts(calls)).toEqual([{ version: 1, answers: [1, 0, 0, 0, 3] }]);
});

it("holds the button during the cooldown after a miss, without revealing a score or which answers were wrong", async () => {
  setup({ attempt: () => ok({ passed: false, retry_after: 30 }) });
  const section = await begin();
  answerAll();
  fireEvent.click(within(section).getByRole("button", { name: "Submit answers" }));
  await screen.findByText("Not passed yet. Read the lesson again if you need to, then try again.");
  expect(within(section).getByRole("button", { name: /^Try again in (30|29)s$/ }).disabled).toBe(true);
  expect(section.textContent).not.toMatch(/\d of 5|Correct answer|Because/);
});

it("starts with the cooldown left from an earlier attempt and re-enables when it ends", async () => {
  setup({ quiz: () => ok(open({ retry_after: 1 })) });
  const section = await begin();
  answerAll();
  expect(within(section).getByRole("button", { name: "Try again in 1s" }).disabled).toBe(true);
  expect(within(section).getByText("Wait a moment before the next attempt.")).toBeTruthy();
  await waitFor(() => expect(within(section).getByRole("button", { name: "Submit answers" }).disabled).toBe(false), { timeout: 3000 });
  expect(within(section).getByText("Ready to submit")).toBeTruthy();
});

it("uses the seconds the server reports when the cooldown has not ended yet", async () => {
  setup({ attempt: () => fail(429, "QUIZ_COOLDOWN", "Wait a moment before trying the quiz again.", { retry_after: 17 }) });
  const section = await begin();
  answerAll();
  fireEvent.click(within(section).getByRole("button", { name: "Submit answers" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Wait a moment before trying again.");
  expect(within(section).getByRole("button", { name: /^Try again in (17|16)s$/ }).disabled).toBe(true);
});

it("shows the answers and the award after a pass, and keeps showing them on a later visit", async () => {
  let passed = false;
  const calls = setup({
    quiz: () => ok(passed ? passedQuiz() : open()),
    attempt: () => { passed = true; return ok({ passed: true, first_pass: true, awarded: true, amount: 15, retry_after: 0 }); },
  });
  const section = await begin();
  answerAll();
  fireEvent.click(within(section).getByRole("button", { name: "Submit answers" }));
  const status = await screen.findByText("Quiz passed. You earned 15 Tide Energy.");
  expect(status.getAttribute("role")).toBe("status");
  const review = await quizSection();
  expect(within(review).getByText(/Because 1\./)).toBeTruthy();
  expect(within(review).getAllByText(/^Correct answer: /)).toHaveLength(5);
  expect(within(review).getByRole("heading", { name: "Why these answers" })).toBeTruthy();
  expect(within(review).getByRole("link", { name: "View energy history →" }).getAttribute("href")).toBe("/user/energy");
  expect(within(review).queryByRole("button", { name: "Submit answers" })).toBeNull();
  expect(asked(calls, quizUrl)).toHaveLength(2);
});

it("says only that the quiz was passed when no energy was awarded", async () => {
  setup({ quiz: () => ok(passedQuiz()) });
  const section = await quizSection();
  expect(within(section).getByText("Quiz passed.")).toBeTruthy();
  expect(section.textContent).not.toContain("Tide Energy");
});

it("asks for a reload when the quiz changed, then starts again on the new questions", async () => {
  let version = 1;
  const calls = setup({
    quiz: () => ok({ ...open({ version }), questions: questions(version) }),
    attempt: () => { version = 2; return fail(409, "STALE_VERSION", "This record changed. Reload it before retrying."); },
  });
  const section = await begin();
  answerAll();
  fireEvent.click(within(section).getByRole("button", { name: "Submit answers" }));
  expect((await screen.findByRole("alert")).textContent).toContain("This quiz was updated while you were answering.");
  expect(within(section).getByRole("button", { name: "Submit answers" }).disabled).toBe(true);
  fireEvent.click(within(section).getByRole("button", { name: "Reload quiz" }));
  await screen.findByText("Prompt 1 v2?", { exact: false });
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByRole("radio", { name: "A1" }).checked).toBe(false);
  expect(within(await quizSection()).getByRole("button", { name: "Submit answers" }).disabled).toBe(true);
  expect(attempts(calls)).toHaveLength(1);
});

it("shows other failures next to the form and lets the member try again", async () => {
  let first = true;
  const calls = setup({ attempt: () => { if (first) { first = false; return fail(500, "UPSTREAM_ERROR", "Supabase could not complete the request."); } return ok({ passed: false, retry_after: 30 }); } });
  const section = await begin();
  answerAll();
  fireEvent.click(within(section).getByRole("button", { name: "Submit answers" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Supabase could not complete the request.");
  expect(within(section).getByRole("button", { name: "Submit answers" }).disabled).toBe(false);
  fireEvent.click(within(section).getByRole("button", { name: "Submit answers" }));
  await screen.findByText("Not passed yet. Read the lesson again if you need to, then try again.");
  expect(screen.queryByText("Supabase could not complete the request.")).toBeNull();
  expect(attempts(calls)).toHaveLength(2);
});

it("tells the member what completing the lesson earned", async () => {
  setup({ completed: false, quiz: () => fail(404, "NOT_FOUND", "x"), complete: () => ok({ user_id: "me", tide_id: id, completed_at: "2026-11-03T00:00:00Z", awarded: true, amount: 10 }) });
  const button = await screen.findByRole("button", { name: "Mark as complete" });
  await waitFor(() => expect(button.disabled).toBe(false));
  fireEvent.click(button);
  expect(await screen.findByText("Completed. You earned 10 Tide Energy.")).toBeTruthy();
});

it("opens on an intro card and shows the questions only after Start quiz", async () => {
  setup();
  const intro = await quizSection();
  expect(within(intro).getByRole("heading", { name: "Quiz: Reading the shoreline" })).toBeTruthy();
  expect(within(intro).getByText("5 questions. Pass with 4 correct to earn 15 more Tide Energy. Retry any time.")).toBeTruthy();
  expect(screen.queryByRole("radio")).toBeNull();
  fireEvent.click(within(intro).getByRole("button", { name: "Start quiz" }));
  expect(await screen.findByText("Choose one answer for each question.")).toBeTruthy();
  expect(screen.getAllByRole("radio")).toHaveLength(20);
  expect(screen.queryByRole("button", { name: "Start quiz" })).toBeNull();
});

it("clears the answers after a miss so the member answers again", async () => {
  setup({ attempt: () => ok({ passed: false, retry_after: 30 }) });
  const section = await begin();
  answerAll();
  fireEvent.click(within(section).getByRole("button", { name: "Submit answers" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Not passed yet. Read the lesson again if you need to, then try again.");
  expect(screen.getByRole("radio", { name: "A1" }).checked).toBe(false);
  expect(within(section).getByText("Wait a moment before the next attempt.")).toBeTruthy();
});

it("says what finishing a lesson earns before it is finished", async () => {
  setup({ completed: false, quiz: () => fail(404, "NOT_FOUND", "x") });
  await screen.findByRole("button", { name: "Mark as complete" });
  expect(screen.getByText("Finishing a lesson earns 5 Tide Energy.")).toBeTruthy();
});
