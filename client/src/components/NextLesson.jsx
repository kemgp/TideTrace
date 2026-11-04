import React from "react";
import { Link } from "react-router-dom";
import useRemoteData from "../hooks/useRemoteData.js";
import { PAGE_SIZE } from "../api/pagination.js";
import { continueLesson } from "../api/dashboardText.js";
import Card from "./Card.jsx";

// "Continue learning": the unfinished lesson the member opened most recently (so it has saved progress).
// With none in progress it offers the next unstarted lesson as "Start learning", with a fallback to the Tides list.
export default function NextLesson() {
  const lessonsResult = useRemoteData(`tides?limit=${PAGE_SIZE}&offset=0`, { collection: true });
  const lessons = lessonsResult.data || [];
  const ids = lessons.map((lesson) => encodeURIComponent(lesson.id)).join(",");
  const completionsResult = useRemoteData(lessons.length ? `tide-completions?tide_ids=${ids}` : null, { collection: true });
  // Where the member stopped in each lesson. A failed read just means every lesson counts as unstarted.
  const savedResult = useRemoteData(lessons.length ? `tide-progress?tide_ids=${ids}` : null, { collection: true });
  if (lessonsResult.loading || (lessons.length && (completionsResult.loading || savedResult.loading))) {
    return <Card className="user-learning-callout"><span className="sk" aria-hidden="true" style={{ display: "block", width: "60%", height: 44, borderRadius: 8 }} /></Card>;
  }
  const loaded = !lessonsResult.error && !completionsResult.error;
  const pick = loaded ? continueLesson(lessons, completionsResult.data, savedResult.error ? [] : savedResult.data) : null;
  const next = pick?.lesson || null;
  const saved = pick?.progress || null;
  const finishedAll = loaded && lessons.length > 0 && !next;
  return <Card className="user-learning-callout">
    <div>
      {next ? <>
        <span className="lbl">{saved ? "Continue learning" : "Start learning"}</span>
        <p className="learning-title">{next.title}</p>
        {saved && <>
          <p className="learning-progress">Chapter {saved.part} of {saved.total}</p>
          <div className="learning-bar" role="progressbar" aria-label="Lesson progress" aria-valuemin={0} aria-valuemax={saved.total} aria-valuenow={saved.part}><span style={{ width: `${Math.round((saved.part / saved.total) * 100)}%` }} /></div>
        </>}
      </> : <>
        <span className="lbl">{finishedAll ? "All caught up" : "Explore Tides"}</span>
        <p>{finishedAll ? "You have finished the latest lessons." : "Coastal lessons from your community."}</p>
      </>}
    </div>
    <Link className="btn blue" to={next ? `/user/tides/${encodeURIComponent(next.id)}` : "/user/tides"}>{next ? (saved ? "Continue lesson →" : "Start lesson →") : "Browse lessons →"}</Link>
  </Card>;
}
