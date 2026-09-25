import React from "react";

export default function TideLesson({ title, body }) {
  return <article aria-label="Lesson content">
    <h2 style={{ fontSize: 24, lineHeight: 1.3, overflowWrap: "anywhere" }}>{title || "Untitled lesson"}</h2>
    <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.8, marginTop: 20 }}>{body || "No lesson content yet."}</div>
  </article>;
}
