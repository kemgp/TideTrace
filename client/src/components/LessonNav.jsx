import React from "react";
import { Link } from "react-router-dom";
import useRemoteData from "../hooks/useRemoteData.js";

// Previous and next lesson, in the same order as the Tides library. After a lesson is completed the
// next one is highlighted. Nothing shows when there is no neighbour or the request fails.
export default function LessonNav({ tideId, completed = false }) {
  const result = useRemoteData(`tides/${encodeURIComponent(tideId)}/neighbors`, { object: true });
  const { previous, next } = result.data || {};
  if (!previous && !next) return null;
  const card = (lesson, label, extra = "") => <Link className={`lesson-nav-card${extra}`} to={`/user/tides/${encodeURIComponent(lesson.id)}`}>
    <span className="lesson-nav-label">{label}</span>
    <span className="lesson-nav-title">{lesson.title}</span>
  </Link>;
  return <nav className="lesson-nav" aria-label="More lessons">
    {previous ? card(previous, "Previous lesson") : <span />}
    {next ? card(next, completed ? "Up next" : "Next lesson", completed ? " is-up-next" : "") : <span />}
  </nav>;
}
