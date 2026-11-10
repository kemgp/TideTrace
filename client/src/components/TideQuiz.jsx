import React, { useEffect, useRef, useState } from "react";
import useRemoteData from "../hooks/useRemoteData.js";
import RemoteState from "./RemoteState.jsx";
import Button from "./Button.jsx";
import { useApp } from "../context/AppContext.jsx";
import "./TideQuiz.css";

// The member's quiz under a completed lesson. Shows nothing when the lesson has no published quiz.
// The server grades: a wrong attempt says only "not passed", and the answers appear after a pass.
export default function TideQuiz({ tideId }) {
  const { profile } = useApp();
  return <Quiz key={`${profile.id}:${tideId}`} tideId={tideId} />;
}

function Quiz({ tideId }) {
  const result = useRemoteData(`tides/${encodeURIComponent(tideId)}/quiz`, { object: true });
  // Kept here because loading the answers after a pass remounts the panel below.
  const [outcome, setOutcome] = useState(null);
  if (result.loading || result.notFound) return null;
  if (result.error) return <section className="card tide-quiz" aria-label="Lesson quiz"><RemoteState {...result} /></section>;
  if (!result.data) return null;
  return <QuizPanel tideId={tideId} quiz={result.data} reload={result.retry} outcome={outcome} onOutcome={setOutcome} />;
}

function QuizPanel({ tideId, quiz, reload, outcome, onOutcome }) {
  const { writeData } = useApp();
  const total = quiz.questions.length;
  const [answers, setAnswers] = useState(() => quiz.questions.map(() => null));
  const [wait, setWait] = useState(quiz.retry_after || 0);
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState("");
  const [missed, setMissed] = useState(false);
  const pending = useRef(null);
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    if (wait <= 0) return undefined;
    const timer = setTimeout(() => setWait((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function submit(event) {
    event.preventDefault();
    if (pending.current || wait > 0 || stale || answers.some((a) => a === null)) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true); setError(""); setMissed(false);
    try {
      const attempt = await writeData(`tides/${encodeURIComponent(tideId)}/quiz/attempts`, { method: "POST", body: { version: quiz.version, answers }, signal: controller.signal });
      if (controller.signal.aborted) return;
      if (typeof attempt?.passed !== "boolean") throw new Error("The result could not be verified.");
      if (attempt.passed) { onOutcome({ awarded: Boolean(attempt.awarded), amount: Number(attempt.amount) || 0 }); reload(); }
      else { setMissed(true); setWait(Number(attempt.retry_after) || 30); }
    } catch (failure) {
      if (controller.signal.aborted || failure.code === "CANCELLED") return;
      if (failure.code === "STALE_VERSION") { setStale(true); setError("This quiz was updated while you were answering. Reload it to see the latest questions."); }
      else if (failure.code === "QUIZ_COOLDOWN") { setWait(Number(failure.details?.retry_after) || 30); setError("Wait a moment before trying again."); }
      else setError(failure.message || "Your answers could not be checked. Try again.");
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  if (quiz.passed) return <section className="card tide-quiz" aria-label="Lesson quiz">
    <h3>Quiz</h3>
    <p role="status">You passed this quiz.{outcome?.awarded && outcome.amount > 0 ? ` You earned ${outcome.amount} Tide Energy.` : ""}</p>
    <ol className="tide-quiz__review">
      {quiz.questions.map((q) => <li key={q.id}>
        <p className="tide-quiz__prompt">{q.prompt}</p>
        <ul>{q.options.map((option, i) => <li key={i} className={i === q.correct_index ? "is-correct" : undefined}>{option}{i === q.correct_index && <> <span className="tide-quiz__tag">Correct answer</span></>}</li>)}</ul>
        {q.explanation && <p className="hint">{q.explanation}</p>}
      </li>)}
    </ol>
  </section>;

  const unanswered = answers.filter((a) => a === null).length;
  return <section className="card tide-quiz" aria-label="Lesson quiz">
    <h3>Check what you learned</h3>
    <p className="hint">Answer all {total} questions. You pass with 4 correct. You can review the lesson and try again.</p>
    <form onSubmit={submit} noValidate>
      <fieldset disabled={busy || stale} className="tide-quiz__fields">
        {quiz.questions.map((q, n) => <fieldset key={q.id} className="tide-quiz__question">
          <legend>{n + 1}. {q.prompt}</legend>
          {q.options.map((option, i) => <label key={i} className="tide-quiz__option">
            <input type="radio" name={`quiz-${q.id}`} checked={answers[n] === i} onChange={() => { setMissed(false); setAnswers((old) => old.map((a, k) => k === n ? i : a)); }} /> {option}
          </label>)}
        </fieldset>)}
      </fieldset>
      <div className="row tide-quiz__actions">
        <Button type="submit" loading={busy} disabled={unanswered > 0 || wait > 0 || stale}>Submit answers</Button>
        {stale && <Button type="button" variant="outline" onClick={reload}>Reload quiz</Button>}
      </div>
      {unanswered > 0 && <p className="hint">{unanswered} {unanswered === 1 ? "question" : "questions"} left to answer.</p>}
      {wait > 0 && <p className="hint">You can try again in {wait} {wait === 1 ? "second" : "seconds"}.</p>}
    </form>
    {missed && <p role="status">Not passed yet. Review the lesson, then try again.</p>}
    {error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
  </section>;
}
