// Pure helpers for the quiz editor. A quiz always has five slots in the editor; the server stores only what was written.
export const QUESTION_COUNT = 5;
export const PASS_MARK = 4;

export const blankQuestion = () => ({ prompt: "", options: ["", "", "", ""], correct: null, explanation: "" });

// Turn the server's quiz into five editable questions.
export function fromServer(quiz) {
  const questions = (quiz?.questions || []).slice(0, QUESTION_COUNT).map((q) => ({
    prompt: q.prompt || "",
    options: [0, 1, 2, 3].map((i) => q.options?.[i] || ""),
    correct: Number.isInteger(q.correct) ? q.correct : null,
    explanation: q.explanation || "",
  }));
  while (questions.length < QUESTION_COUNT) questions.push(blankQuestion());
  return questions;
}

const clean = (q) => ({ prompt: q.prompt.trim(), options: q.options.map((o) => o.trim()), correct: q.correct, explanation: q.explanation.trim() });
const isBlank = (q) => !q.prompt && q.options.every((o) => !o) && q.correct === null && !q.explanation;

// What gets saved: trimmed text, without empty questions at the end.
export function toPayload(questions) {
  const list = questions.map(clean);
  while (list.length && isBlank(list[list.length - 1])) list.pop();
  return list;
}

// Short, fixable reasons a question is not ready to publish. Empty means ready.
export function questionProblems(question) {
  const q = clean(question);
  const problems = [];
  if (!q.prompt) problems.push("Add the question");
  const filled = q.options.filter(Boolean);
  if (filled.length < 4) problems.push("Fill in all 4 options");
  else if (new Set(filled.map((o) => o.toLowerCase())).size < 4) problems.push("Make the 4 options different");
  if (q.correct === null) problems.push("Mark the correct option");
  if (!q.explanation) problems.push("Add an explanation");
  return problems;
}

export const readyCount = (questions) => questions.filter((q) => questionProblems(q).length === 0).length;
export const isComplete = (questions) => questions.length === QUESTION_COUNT && readyCount(questions) === QUESTION_COUNT;

// Grade a preview locally. Nothing is sent anywhere.
export function gradePreview(questions, answers) {
  const right = questions.map((q, i) => answers[i] === q.correct);
  const score = right.filter(Boolean).length;
  return { score, total: questions.length, passed: score >= PASS_MARK, right };
}
