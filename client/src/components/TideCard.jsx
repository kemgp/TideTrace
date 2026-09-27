import React from "react";
import { Link } from "react-router-dom";

export default function TideCard({ tide, completionLabel }) {
  return <Link className="tcard user-tide-card" to={`/user/tides/${encodeURIComponent(tide.id)}`} style={{ display: "block", color: "inherit", textDecoration: "none" }}>
    <div className="thumb" aria-hidden="true" />
    <div className="t" style={{ overflowWrap: "anywhere" }}>{tide.title}</div>
    <div className="m"><span>Read lesson →</span>{completionLabel && <span className={`user-lesson-status${completionLabel === "Completed" ? " is-complete" : ""}`}>{completionLabel}</span>}</div>
  </Link>;
}
