import React, { useEffect, useRef, useState } from "react";
import useRemoteData from "../hooks/useRemoteData.js";
import RemoteState from "./RemoteState.jsx";
import ConfirmDialog from "./ConfirmDialog.jsx";
import Card from "./Card.jsx";
import Button from "./Button.jsx";
import { useApp } from "../context/AppContext.jsx";
import { PASS_MARK, QUESTION_COUNT, fromServer, gradePreview, isComplete, questionProblems, readyCount, toPayload } from "../api/quiz.js";
import "./QuizEditor.css";

// The admin's quiz card on the lesson editor. Loads the quiz with its answer key, then hands it to the panel.
export default function QuizEditor({ tideId, tideStatus, onDirtyChange }) {
  const result = useRemoteData(`admin/tides/${encodeURIComponent(tideId)}/quiz`, { object: true });
  return <Card>
    <h3 style={{ marginTop: 0 }}>Quiz</h3>
    <RemoteState {...result} />
    {result.data && <QuizPanel initial={result.data} tideId={tideId} tideStatus={tideStatus} reload={result.retry} onDirtyChange={onDirtyChange} />}
  </Card>;
}

const sameQuiz = (a, b) => JSON.stringify(toPayload(a)) === JSON.stringify(toPayload(b));
const statusLabel = (quiz) => !quiz.exists ? "No quiz yet" : quiz.status === "published" ? `Published, version ${quiz.version}` : `Draft, version ${quiz.version}`;

function QuizPanel({ initial, tideId, tideStatus, reload, onDirtyChange }) {
  const { writeData } = useApp();
  const [saved, setSaved] = useState(initial);
  const [questions, setQuestions] = useState(() => fromServer(initial));
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [asking, setAsking] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const request = useRef(null);
  const published = saved.exists && saved.status === "published";
  const dirty = !sameQuiz(questions, fromServer(saved));
  const complete = isComplete(questions);
  const path = `admin/tides/${encodeURIComponent(tideId)}/quiz`;
  const q = questions[index];

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);

  const edit = (patch) => { setNotice(""); setQuestions((old) => old.map((item, i) => i === index ? { ...item, ...patch } : item)); };
  const editOption = (i, value) => edit({ options: q.options.map((o, n) => n === i ? value : o) });

  async function send(url, options, check, done) {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError(""); setNotice("");
    try {
      const next = await writeData(url, { ...options, signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!next?.exists || !check(next)) throw new Error("Could not verify the saved quiz.");
      setSaved(next); setAsking(false);
      done(next);
    } catch (failure) {
      if (controller.signal.aborted || failure.code === "CANCELLED") return;
      setAsking(false);
      if (failure.code === "STALE_VERSION") { setBlocked(true); setError("This quiz was changed somewhere else. Reload the quiz to see the latest version. Your edits here are not saved."); }
      else setError(failure.message || "The quiz could not be saved.");
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  // `publish` is the state the quiz should end up in.
  const save = (publish) => send(path, { method: "PUT", body: { version: saved.exists ? saved.version : null, publish, questions: toPayload(questions) } },
    (next) => next.status === (publish ? "published" : "draft"),
    (next) => { setQuestions(fromServer(next)); setNotice(publish ? (published ? `Changes published as version ${next.version}.` : `Quiz published as version ${next.version}.`) : "Draft saved."); });
  const unpublish = () => send(`${path}/unpublish`, { method: "POST", body: { version: saved.version } },
    (next) => next.status === "draft",
    () => setNotice("Quiz unpublished. Members no longer see it."));

  return <div className="quiz-editor">
    <div className="quiz-head">
      <span className={`badge ${published ? "approved" : "pending"}`}>{statusLabel(saved)}</span>
      <span className="hint">5 questions, 4 options each. Members pass with {PASS_MARK} of {QUESTION_COUNT}.</span>
    </div>
    {tideStatus !== "published" && <p className="hint">Members see the quiz only while the lesson is published.</p>}
    <div className="quiz-chips" role="group" aria-label="Questions">
      {questions.map((item, i) => <button key={i} type="button" className={`chip${i === index ? " on" : ""}`} aria-current={i === index ? "true" : undefined} onClick={() => setIndex(i)}>
        Question {i + 1}{" "}<span className="sr-only">{questionProblems(item).length ? "incomplete" : "complete"}</span>
      </button>)}
    </div>
    <fieldset className="quiz-question" disabled={busy || blocked}>
      <label className="lbl" htmlFor="quiz-prompt">Question {index + 1}</label>
      <textarea id="quiz-prompt" className="input" rows={2} maxLength={500} value={q.prompt} onChange={(event) => edit({ prompt: event.target.value })} />
      <div role="radiogroup" aria-label={`Options for question ${index + 1}`} className="quiz-options">
        {q.options.map((option, i) => <div className="quiz-option" key={i}>
          <input className="input" aria-label={`Option ${i + 1}`} placeholder={`Option ${i + 1}`} maxLength={300} value={option} onChange={(event) => editOption(i, event.target.value)} />
          <label className="quiz-correct"><input type="radio" name={`correct-${index}`} aria-label={`Option ${i + 1} is the correct answer`} checked={q.correct === i} onChange={() => edit({ correct: i })} /> Correct</label>
        </div>)}
      </div>
      <label className="lbl" htmlFor="quiz-explanation">Explanation</label>
      <textarea id="quiz-explanation" className="input" rows={3} maxLength={1000} value={q.explanation} onChange={(event) => edit({ explanation: event.target.value })} />
      <p className="hint">Members read this after they pass.</p>
    </fieldset>

    <h4 className="quiz-sub">Before publishing</h4>
    <p className="hint" style={{ margin: 0 }}>{readyCount(questions)} of {QUESTION_COUNT} questions are ready.</p>
    <ul className="quiz-checklist" aria-label="Before publishing">
      {questions.map((item, i) => { const problems = questionProblems(item); return <li key={i}>Question {i + 1}: {problems.length ? problems.join(". ") + "." : "Ready."}</li>; })}
    </ul>

    {published && <p className="hint">Saving changes publishes version {saved.version + 1}. Members with the quiz open are asked to reload. Energy already earned stays.</p>}
    <div className="row quiz-actions">
      {published
        ? <>
          <Button disabled={!dirty || !complete || blocked} loading={busy} onClick={() => save(true)}>Save changes</Button>
          <Button variant="outline" disabled={busy || blocked} onClick={() => setAsking(true)}>Unpublish quiz</Button>
        </>
        : <>
          <Button variant="outline" disabled={!dirty || busy || blocked} loading={busy} onClick={() => save(false)}>Save quiz draft</Button>
          <Button disabled={!complete || busy || blocked} onClick={() => save(true)}>Publish quiz</Button>
        </>}
      <Button variant="outline" disabled={!complete} onClick={() => setPreviewing((value) => !value)}>{previewing ? "Hide quiz preview" : "Preview quiz"}</Button>
      {blocked && <Button variant="outline" onClick={reload}>Reload quiz</Button>}
    </div>
    {!complete && <p className="hint">Preview and publishing unlock when all 5 questions are ready.</p>}
    {dirty && !blocked && <p className="hint">You have unsaved quiz changes.</p>}
    {busy && <p role="status">Saving quiz…</p>}
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
    {previewing && complete && <QuizPreview questions={questions} />}
    {asking && <ConfirmDialog title="Unpublish this quiz?" confirmLabel="Unpublish" busy={busy} onConfirm={unpublish} onCancel={() => { if (!busy) setAsking(false); }}>
      <p>Members no longer see the quiz. Energy already earned stays. Your unsaved edits below stay in the editor. Publishing again creates a new version.</p>
    </ConfirmDialog>}
  </div>;
}

// Grades locally from the editor's current text. It never calls the server and earns nothing.
function QuizPreview({ questions }) {
  const [answers, setAnswers] = useState(() => questions.map(() => null));
  const [result, setResult] = useState(null);
  const ready = answers.every((a) => a !== null);
  const reset = () => { setAnswers(questions.map(() => null)); setResult(null); };
  return <section className="quiz-preview" aria-label="Quiz preview">
    <h4 className="quiz-sub">Quiz preview</h4>
    <p className="hint" style={{ margin: 0 }}>Preview only. This earns no Tide Energy. It uses your current edits, saved or not.</p>
    {questions.map((item, i) => <fieldset key={i} className="quiz-preview-q" disabled={Boolean(result)}>
      <legend>{i + 1}. {item.prompt}</legend>
      {item.options.map((option, n) => <label key={n} className="quiz-preview-option">
        <input type="radio" name={`preview-${i}`} checked={answers[i] === n} onChange={() => setAnswers((old) => old.map((a, k) => k === i ? n : a))} /> {option}
      </label>)}
      {result?.passed && <p className="hint">{result.right[i] ? "Correct." : `The correct answer is: ${item.options[item.correct]}.`} {item.explanation}</p>}
    </fieldset>)}
    {result
      ? <>
        <p role="status">{result.passed ? `You got ${result.score} of ${result.total}. Passed. A member would earn Tide Energy here.` : `You got ${result.score} of ${result.total}. Not passed yet. Members need ${PASS_MARK} of ${QUESTION_COUNT}.`}</p>
        <Button variant="outline" size="sm" onClick={reset}>Try again</Button>
      </>
      : <Button variant="outline" size="sm" disabled={!ready} onClick={() => setResult(gradePreview(questions, answers))}>Check my answers</Button>}
  </section>;
}
