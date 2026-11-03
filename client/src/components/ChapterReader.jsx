import React, { useEffect, useRef } from "react";
import LessonBody from "./LessonBody.jsx";

// Shows one chapter of a lesson at a time, with a contents list and Previous/Next buttons.
// `chapters` comes from splitChapters; `part` is the 1-based chapter number and `onPart` changes it.
export default function ChapterReader({ chapters, part, onPart, images }) {
  const total = chapters.length;
  const current = Math.min(Math.max(part, 1), total);
  const chapter = chapters[current - 1];
  const top = useRef(null);
  const region = useRef(null);
  const first = useRef(true);
  // After a chapter change, bring the top of the reader into view and move keyboard focus to the chapter.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    region.current?.focus({ preventScroll: true });
    // Instant, not smooth: a smooth scroll fights the content height changing underneath it.
    top.current?.scrollIntoView?.({ block: "start", behavior: "instant" });
  }, [current]);
  const go = (next) => { if (next >= 1 && next <= total && next !== current) onPart(next); };
  return <div className="chapters" ref={top}>
    <details className="chapter-contents">
      <summary>Chapter {current} of {total}: {chapter.title}</summary>
      <nav aria-label="Chapters">
        <ol>
          {chapters.map((item, index) => <li key={index}>
            <button type="button" aria-current={index + 1 === current ? "step" : undefined} onClick={() => go(index + 1)}><span className={`chapter-dot${index + 1 < current ? " is-done" : ""}`} aria-hidden="true">{index + 1 < current ? "✓" : index + 1}</span>{item.title}</button>
          </li>)}
        </ol>
      </nav>
    </details>
    <div ref={region} tabIndex={-1} className="chapter-body" aria-label={`Chapter ${current}: ${chapter.title}`} role="region">
      <p className="chapter-eyebrow">Chapter {current} of {total}</p>
      <LessonBody blocks={chapter.blocks} images={images} />
    </div>
    <div className="chapter-controls">
      <button type="button" className="btn outline sm" disabled={current <= 1} onClick={() => go(current - 1)}>Previous chapter</button>
      <span className="chapter-count" aria-live="polite">Chapter {current} of {total}</span>
      <button type="button" className="btn blue sm" disabled={current >= total} onClick={() => go(current + 1)}>Next chapter</button>
    </div>
  </div>;
}
