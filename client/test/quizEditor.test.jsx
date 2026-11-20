import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "./router.jsx";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";
import { sampleTide } from "../src/data/sampleTide.js";
import { blankQuestion, fromServer, gradePreview, isComplete, questionProblems, toPayload } from "../src/api/quiz.js";

const id = "50000000-0000-4000-8000-000000000001";
const stamp = "2026-10-25T00:00:00.000Z";
const detail = `/api/admin/tides/${id}`;
const quizUrl = `${detail}/quiz`;
const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const fail = (status, code, message) => ({ ok: false, status, json: async () => ({ error: { code, message } }) });
const lesson = (extra = {}) => ({ ...sampleTide, id, status: "published", updated_at: stamp, paged: false, slides_path: null, ...extra });
const question = (n) => ({ prompt: `Question ${n}?`, options: [`A${n}`, `B${n}`, `C${n}`, `D${n}`], correct: n % 4, explanation: `Because ${n}.` });
const serverQuiz = (status, version, count = 5) => ({
  tide_id: id, exists: true, status, version, published_at: null, updated_at: stamp, passes: 0,
  questions: Array.from({ length: count }, (_, i) => ({ id: `q${i}`, position: i + 1, ...question(i + 1) })),
});
const noQuiz = { tide_id: id, exists: false, status: null, version: null, questions: [] };

beforeEach(() => {
  sessionStorage.clear();
  vi.stubEnv("VITE_ENERGY_ENABLED", "true");
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value: function () { this.open = true; } },
    close: { configurable: true, value: function () { this.open = false; } },
  });
});
afterEach(() => vi.unstubAllEnvs());

function setup({ quiz = noQuiz, status = "published", write = () => undefined } = {}) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "access", refresh_token: "refresh", expires_at: Date.now() / 1000 + 3600 }));
  const calls = vi.fn(async (url, options = {}) => {
    if (url === "/api/auth/me") return ok({ id: "me", display_name: "Admin", role: "admin", status: "active" });
    if (url === quizUrl || url === `${quizUrl}/unpublish`) {
      if (options.body) return write(url, JSON.parse(options.body)) || ok(quiz);
      return ok(quiz);
    }
    if (url === detail) return ok(lesson({ status }));
    return ok([]);
  });
  vi.stubGlobal("fetch", calls);
  return calls;
}
const open = () => render(<MemoryRouter initialEntries={[`/admin/tides/${id}/edit`]}><App /></MemoryRouter>);
const writes = (calls) => calls.mock.calls.filter(([url, options]) => url.startsWith(quizUrl) && options?.body).map(([url, options]) => ({ url, method: options.method, body: JSON.parse(options.body) }));
const chip = (n) => screen.getByRole("button", { name: new RegExp(`^Question ${n}`) });
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const fillQuestion = (n) => {
  const q = question(n);
  fireEvent.click(chip(n));
  type(`Question ${n}`, q.prompt);
  q.options.forEach((o, i) => type(`Option ${i + 1}`, o));
  fireEvent.click(screen.getByLabelText(`Mark option ${q.correct + 1} as correct`));
  type("Explanation", q.explanation);
};

it("pure helpers pad, trim, check and grade", () => {
  expect(fromServer(noQuiz)).toHaveLength(5);
  expect(fromServer({ questions: [question(1)] }).slice(1).every((q) => q.correct === null)).toBe(true);
  const padded = [{ ...question(1), prompt: "  Hi  " }, blankQuestion(), blankQuestion()];
  expect(toPayload(padded)).toEqual([{ ...question(1), prompt: "Hi" }]);
  expect(toPayload(Array.from({ length: 5 }, blankQuestion))).toEqual([]);
  expect(questionProblems(blankQuestion())).toEqual(["Add the question", "Fill in all 4 options", "Mark the correct option", "Add an explanation"]);
  expect(questionProblems({ ...question(1), options: ["x", "X", "y", "z"] })).toEqual(["Make the 4 options different"]);
  expect(isComplete(fromServer(serverQuiz("draft", 1)))).toBe(true);
  expect(isComplete(fromServer(serverQuiz("draft", 1, 4)))).toBe(false);
  const qs = fromServer(serverQuiz("draft", 1));
  expect(gradePreview(qs, qs.map((q) => q.correct)).passed).toBe(true);
  expect(gradePreview(qs, qs.map((q, i) => i < 4 ? q.correct : (q.correct + 1) % 4))).toMatchObject({ score: 4, passed: true });
  expect(gradePreview(qs, qs.map((q, i) => i < 3 ? q.correct : (q.correct + 1) % 4))).toMatchObject({ score: 3, passed: false });
});

it("hides the Quiz card while the flag is off", async () => {
  vi.stubEnv("VITE_ENERGY_ENABLED", "");
  const calls = setup();
  open();
  await screen.findByLabelText("Lesson title");
  expect(screen.queryByRole("heading", { name: "Quiz" })).toBeNull();
  expect(calls.mock.calls.some(([url]) => url === quizUrl)).toBe(false);
});

it("asks for the lesson to be saved first on a new lesson", async () => {
  setup();
  render(<MemoryRouter initialEntries={["/admin/tides/new"]}><App /></MemoryRouter>);
  expect(await screen.findByText("Save the lesson once to add a quiz.")).toBeTruthy();
});

it("builds a quiz, keeps publishing locked until all five questions are ready, then publishes", async () => {
  const calls = setup({ status: "draft", write: (url, body) => ok({ ...serverQuiz(body.publish ? "published" : "draft", body.version ? body.version + 1 : 1), questions: body.questions.map((q, i) => ({ id: `q${i}`, position: i + 1, ...q })) }) });
  open();
  expect(await screen.findByText("No quiz yet")).toBeTruthy();
  expect(screen.getByText("Members see the quiz only while the lesson is published.")).toBeTruthy();
  const publish = screen.getByRole("button", { name: "Publish quiz" });
  expect(publish.disabled).toBe(true);
  expect(screen.getByRole("button", { name: "Preview quiz" }).disabled).toBe(true);
  expect(screen.getByRole("button", { name: "Save quiz draft" }).disabled).toBe(true);
  fillQuestion(1);
  expect(screen.getByRole("button", { name: "Question 1, ready" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Question 2, needs attention" })).toBeTruthy();
  const checks = screen.getByRole("list", { name: "Publishing checks" });
  ["Five questions", "Four options for every question", "One correct answer for every question", "An explanation for every question"].forEach((text) => expect(checks.textContent).toContain(`${text}. Not done`));
  // A partial draft can be saved. Trailing empty questions are not sent.
  fireEvent.click(screen.getByRole("button", { name: "Save quiz draft" }));
  await screen.findByText("Draft saved.");
  expect(writes(calls)[0]).toMatchObject({ url: quizUrl, method: "PUT", body: { version: null, publish: false, questions: [question(1)] } });
  expect(await screen.findByText("Draft")).toBeTruthy();
  [2, 3, 4, 5].forEach(fillQuestion);
  ["Five questions", "Four options for every question", "One correct answer for every question", "An explanation for every question"].forEach((text) => expect(screen.getByRole("list", { name: "Publishing checks" }).textContent).toContain(`${text}. Done`));
  fireEvent.click(screen.getByRole("button", { name: "Publish quiz" }));
  await screen.findByText("Quiz version 2 published.");
  expect(writes(calls)[1].body).toMatchObject({ version: 1, publish: true });
  expect(writes(calls)[1].body.questions).toHaveLength(5);
  expect(await screen.findByText("Published")).toBeTruthy();
});

it("warns about the next version on a published quiz and saves changes with the loaded version", async () => {
  const calls = setup({ quiz: serverQuiz("published", 3), write: (url, body) => ok({ ...serverQuiz("published", 4), questions: body.questions.map((q, i) => ({ id: `q${i}`, position: i + 1, ...q })) }) });
  open();
  expect(await screen.findByText("Published")).toBeTruthy();
  expect(screen.getByText("Saving changes publishes version 4. Members with the quiz open are asked to reload. Energy already earned stays.")).toBeTruthy();
  expect(screen.queryByText("Members see the quiz only while the lesson is published.")).toBeNull();
  const save = screen.getByRole("button", { name: "Save changes" });
  expect(save.disabled).toBe(true);
  type("Question 1", "A reworded question?");
  expect(screen.getByText("You have unsaved quiz changes.")).toBeTruthy();
  fireEvent.click(save);
  await screen.findByText("Quiz version 4 published.");
  expect(writes(calls)[0].body).toMatchObject({ version: 3, publish: true });
  expect(writes(calls)[0].body.questions[0].prompt).toBe("A reworded question?");
  expect(await screen.findByText("Saving changes publishes version 5. Members with the quiz open are asked to reload. Energy already earned stays.")).toBeTruthy();
});

it("blocks further saves after a stale save until the quiz is reloaded", async () => {
  setup({ quiz: serverQuiz("published", 3), write: () => fail(409, "STALE_VERSION", "Changed.") });
  open();
  await screen.findByText("Published");
  type("Question 1", "Changed locally");
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect((await screen.findByRole("alert")).textContent).toContain("This quiz was changed somewhere else.");
  expect(screen.getByRole("button", { name: "Save changes" }).disabled).toBe(true);
  expect(screen.getByLabelText("Question 1").matches(":disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Reload quiz" }));
  await waitFor(() => expect(screen.queryByRole("button", { name: "Reload quiz" })).toBeNull());
  expect(screen.getByLabelText("Question 1").value).toBe("Question 1?");
});

it("shows other save errors next to the card and lets the admin try again", async () => {
  let attempts = 0;
  setup({ quiz: serverQuiz("draft", 1), write: (url, body) => ++attempts === 1 ? fail(400, "INVALID_DATA", "Publishing needs 5 complete questions.") : ok(serverQuiz("published", 2)) });
  open();
  await screen.findByText("Draft");
  fireEvent.click(screen.getByRole("button", { name: "Publish quiz" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Publishing needs 5 complete questions.");
  expect(screen.getByRole("button", { name: "Publish quiz" }).disabled).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Publish quiz" }));
  await screen.findByText("Quiz version 2 published.");
  expect(screen.queryByRole("alert")).toBeNull();
});

it("unpublishes after confirmation, sends only the saved version and keeps unsaved edits", async () => {
  const calls = setup({ quiz: serverQuiz("published", 3), write: () => ok(serverQuiz("draft", 4)) });
  open();
  await screen.findByText("Published");
  type("Question 1", "Unsaved wording");
  fireEvent.click(screen.getByRole("button", { name: "Unpublish quiz" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText(/Energy already earned stays/)).toBeTruthy();
  expect(writes(calls)).toHaveLength(0);
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Unpublish quiz" }));
  fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Unpublish" }));
  await screen.findByText("Quiz unpublished. Members no longer see it.");
  expect(writes(calls)).toEqual([{ url: `${quizUrl}/unpublish`, method: "POST", body: { version: 3 } }]);
  expect(await screen.findByText("Draft")).toBeTruthy();
  expect(screen.getByLabelText("Question 1").value).toBe("Unsaved wording");
  expect(screen.getByRole("button", { name: "Publish quiz" })).toBeTruthy();
});

it("previews the quiz locally: grades, reveals answers only after a pass and earns nothing", async () => {
  const calls = setup({ quiz: serverQuiz("draft", 1) });
  open();
  await screen.findByText("Draft");
  fireEvent.click(screen.getByRole("button", { name: "Preview quiz" }));
  const preview = await screen.findByRole("region", { name: "Quiz preview" });
  expect(within(preview).getByText(/This earns no Tide Energy/)).toBeTruthy();
  const check = within(preview).getByRole("button", { name: "Check my answers" });
  expect(check.disabled).toBe(true);
  const pick = (i, option) => fireEvent.click(within(preview).getAllByRole("radio").filter((r) => r.name === `preview-${i}`)[option]);
  // Get 3 right and 2 wrong.
  [1, 2, 3, 4, 5].forEach((n, i) => pick(i, i < 3 ? question(n).correct : (question(n).correct + 1) % 4));
  expect(check.disabled).toBe(false);
  fireEvent.click(check);
  expect(within(preview).getByRole("status").textContent).toContain("You got 3 of 5. Not passed yet.");
  expect(within(preview).queryByText(/Because 1\./)).toBeNull();
  fireEvent.click(within(preview).getByRole("button", { name: "Try again" }));
  [1, 2, 3, 4, 5].forEach((n, i) => pick(i, question(n).correct));
  fireEvent.click(within(preview).getByRole("button", { name: "Check my answers" }));
  expect(within(preview).getByRole("status").textContent).toContain("You got 5 of 5. Passed.");
  expect(within(preview).getByText(/Because 1\./)).toBeTruthy();
  expect(writes(calls)).toHaveLength(0);
  expect(calls.mock.calls.some(([url]) => /energy|complete|submit/.test(url))).toBe(false);
});

it("flags a question that has text but no correct answer, and shows the mockup labels", async () => {
  setup({ status: "draft" });
  open();
  await screen.findByText("No quiz yet");
  expect(screen.queryByRole("alert")).toBeNull();
  type("Question 1", "What is a tide?");
  expect((await screen.findByRole("alert")).textContent).toBe("Choose the correct answer.");
  fireEvent.click(screen.getByLabelText("Mark option 2 as correct"));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByText("Options. Mark the correct one.")).toBeTruthy();
  expect(screen.getByText("Shown to members only after they pass.")).toBeTruthy();
  expect(screen.getByText("Admin previews earn no energy.")).toBeTruthy();
  expect(screen.getByText("Five questions, four options each, one correct answer. Members pass with 4 correct.")).toBeTruthy();
});

it("tells the admin when saving is locked on a published quiz", async () => {
  setup({ quiz: { ...serverQuiz("published", 2), questions: serverQuiz("published", 2).questions.slice(0, 4) } });
  open();
  await screen.findByText("Published");
  expect(screen.getByText("Save is available when all five questions are ready.")).toBeTruthy();
});
