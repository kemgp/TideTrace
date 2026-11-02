import React from "react";
import { readingMinutes } from "../api/tideText.js";
import LessonBody from "./LessonBody.jsx";
import "./Lesson.css";

export default function TideLesson({ title, body, hideTitle = false }) {
  const minutes = readingMinutes(body);
  return <article aria-label="Lesson content" className="lesson">
    {!hideTitle && <h2 className="lesson-title">{title || "Untitled lesson"}</h2>}
    {minutes && <p className="lesson-meta">{minutes} min read</p>}
    <LessonBody body={body} />
  </article>;
}
