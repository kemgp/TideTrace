import React from "react";
import { Link } from "react-router-dom";
import { readingMinutes, tideExcerpt } from "../api/tideText.js";
import TideThumb from "./TideThumb.jsx";
import "./TideCard.css";

export default function TideCard({ tide, completionLabel }) {
  const excerpt = (typeof tide.summary === "string" && tide.summary.trim()) || tideExcerpt(tide.body);
  const minutes = readingMinutes(tide.body);
  return <Link className="tcard user-tide-card" to={`/user/tides/${encodeURIComponent(tide.id)}`}>
    <div className="tide-cover">
      <TideThumb tide={tide} />
      {tide.category?.name && <span className="tide-topic">{tide.category.name}</span>}
    </div>
    <div className="tide-card-body">
    <div className="t" style={{ overflowWrap: "anywhere" }}>{tide.title}</div>
    {excerpt && <p className="tide-excerpt">{excerpt}</p>}
    <div className="m">
      <span>{minutes ? `${minutes} min read` : "Lesson"}</span>
      {completionLabel && <span className={`user-lesson-status${completionLabel === "Completed" ? " is-complete" : ""}${completionLabel.startsWith("In progress") ? " is-progress" : ""}`}>{completionLabel}</span>}
    </div>
    </div>
  </Link>;
}
