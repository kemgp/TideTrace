import React from "react";
import { Link } from "react-router-dom";
import useRemoteData from "../hooks/useRemoteData.js";
import { PAGE_SIZE } from "../api/pagination.js";
import { nextLesson } from "../api/dashboardText.js";
import Card from "./Card.jsx";

// "Continue learning": the first lesson the member has not finished, with a fallback to the Tides list.
export default function NextLesson() {
  const lessonsResult = useRemoteData(`tides?limit=${PAGE_SIZE}&offset=0`, { collection: true });
  const lessons = lessonsResult.data || [];
  const completionsResult = useRemoteData(lessons.length ? `tide-completions?tide_ids=${lessons.map((lesson) => encodeURIComponent(lesson.id)).join(",")}` : null, { collection: true });
  const next = !lessonsResult.loading && !lessonsResult.error && !completionsResult.loading && !completionsResult.error ? nextLesson(lessons, completionsResult.data) : null;
  // Where the member stopped in the next lesson, if it has chapters. Missing or failed reads just hide the detail.
  const savedResult = useRemoteData(next ? `tide-progress?tide_ids=${encodeURIComponent(next.id)}` : null, { collection: true });
  const saved = savedResult.data?.find((record) => record.tide_id === next?.id);
  if (lessonsResult.loading || (lessons.length && completionsResult.loading)) {
    return <Card className="user-learning-callout"><span className="sk" aria-hidden="true" style={{ display: "block", width: "60%", height: 44, borderRadius: 8 }} /></Card>;
  }
  const finishedAll = !lessonsResult.error && !completionsResult.error && lessons.length > 0 && !next;
  return <Card className="user-learning-callout">
    <div>
      {next ? <>
        <span className="lbl">Next lesson</span>
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
    <Link className="btn blue" to={next ? `/user/tides/${encodeURIComponent(next.id)}` : "/user/tides"}>{next ? (saved ? "Continue lesson →" : "Open lesson →") : "Browse lessons →"}</Link>
  </Card>;
}
