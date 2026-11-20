import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import useRemoteData from "../hooks/useRemoteData.js";
import RemoteState from "./RemoteState.jsx";
import Button from "./Button.jsx";
import { useApp } from "../context/AppContext.jsx";
import { energyEnabled, notifyEnergyChanged } from "../api/energy.js";
import "./TideQuiz.css";
import "./energy.css";

// The member's quiz under a completed lesson. Shows nothing when the lesson has no published quiz.
// The server grades: a wrong attempt says only "not passed", and the answers appear after a pass.
export default function TideQuiz({ tideId, title }) {
  const { profile } = useApp();
  return <Quiz key={`${profile.id}:${tideId}`} tideId={tideId} title={title} />;
}

function Quiz({ tideId, title }) {
  const result = useRemoteData(`tides/${encodeURIComponent(tideId)}/quiz`, { object: true });
  // Kept here because loading the answers after a pass remounts the panel below.
  const [outcome, setOutcome] = useState(null);
  // "Start quiz" is remembered here for the same reason, so a reload after an update goes straight back to the questions.
  const [started, setStarted] = useState(false);
  if (result.loading || result.notFound) return null;
  if (result.error) return <section className="card tide-quiz" aria-label="Lesson quiz"><RemoteState {...result} /></section>;
  if (!result.data) return null;
  return <QuizPanel tideId={tideId} title={title} quiz={result.data} reload={result.retry} outcome={outcome} onOutcome={setOutcome} started={started} onStart={() => setStarted(true)} />;
}

function QuizPanel({ tideId, title, quiz, reload, outcome, onOutcome, started, onStart }) {
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
      if (attempt.passed) { onOutcome({ awarded: Boolean(attempt.awarded), amount: Number(attempt.amount) || 0 }); if (attempt.awarded) notifyEnergyChanged(); reload(); }
      else { setMissed(true); setAnswers(quiz.questions.map(() => null)); setWait(Number(attempt.retry_after) || 30); }
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

  const heading = title ? `Quiz: ${title}` : "Quiz";
  if (quiz.passed) return <section className="tide-quiz" aria-label="Lesson quiz">
    <p className="notice is-success" role="status">{outcome?.awarded && outcome.amount > 0 ? `Quiz passed. You earned ${outcome.amount} Tide Energy.` : "Quiz passed."}</p>
    <h2 className="tide-quiz__title">Why these answers</h2>
    <div className="tide-quiz__why">
      {quiz.questions.map((q, n) => <div className="explain" key={q.id}>
        <b>{n + 1}. {q.prompt}</b>Correct answer: {q.options[q.correct_index]}.{q.explanation ? ` ${q.explanation}` : ""}
      </div>)}
    </div>
    {energyEnabled() && <Link className="btn outline sm" to="/user/energy">View energy history →</Link>}
  </section>;

  if (!started) return <section className="energy-card tide-quiz" aria-label="Lesson quiz">
    <div className="tide-quiz__intro">
      <div>
        <h2>{heading}</h2>
        <p className="hint">{total} questions. Pass with 4 correct to earn 15 more Tide Energy. Retry any time.</p>
      </div>
      <button type="button" className="btn blue" onClick={onStart}>Start quiz</button>
    </div>
  </section>;

  const unanswered = answers.filter((a) => a === null).length;
  const hint = wait > 0 ? "Wait a moment before the next attempt." : unanswered > 0 ? `${unanswered} left to answer` : "Ready to submit";
  return <section className="tide-quiz" aria-label="Lesson quiz">
    <h2 className="tide-quiz__title">{heading}</h2>
    <p className="hint">Choose one answer for each question.</p>
    {missed && <p className="notice is-error" role="alert">Not passed yet. Read the lesson again if you need to, then try again.</p>}
    <form onSubmit={submit} noValidate>
      <fieldset disabled={busy || stale} className="tide-quiz__fields">
        {quiz.questions.map((q, n) => <fieldset key={q.id} className="quiz-q">
          <legend>{n + 1}. {q.prompt}</legend>
          {q.options.map((option, i) => <label key={i} className="quiz-opt">
            <input type="radio" name={`quiz-${q.id}`} checked={answers[n] === i} onChange={() => { setMissed(false); setAnswers((old) => old.map((a, k) => k === n ? i : a)); }} /><span>{option}</span>
          </label>)}
        </fieldset>)}
      </fieldset>
      <div className="row tide-quiz__actions">
        <Button type="submit" loading={busy} disabled={unanswered > 0 || wait > 0 || stale}>{wait > 0 ? `Try again in ${wait}s` : "Submit answers"}</Button>
        {stale && <Button type="button" variant="outline" onClick={reload}>Reload quiz</Button>}
        <span className="hint" aria-live="polite">{hint}</span>
      </div>
    </form>
    {error && <p className="notice is-error" role="alert">{error}</p>}
  </section>;
}
