import React, { useState } from "react";
import { tideTone } from "../api/tideText.js";

// Lesson card picture: a colour block with a book icon, or the lesson's image once lessons have one
// (`tide.image_url`). The image fades in only after it has fully loaded, and a broken image falls back to the block.
export default function TideThumb({ tide, priority = false }) {
  const source = typeof tide?.image_url === "string" && /^https?:\/\//.test(tide.image_url) ? tide.image_url : "";
  const [state, setState] = useState("loading");
  const showImage = source && state !== "failed";
  return <span className="tide-thumb" data-tone={tideTone(tide?.id)} aria-hidden="true">
    <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
    {showImage && <img src={source} alt="" referrerPolicy="no-referrer" decoding="async" loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} style={{ opacity: state === "loaded" ? 1 : 0 }}
      onLoad={(event) => { const image = event.currentTarget; (image.decode ? image.decode().catch(() => {}) : Promise.resolve()).then(() => setState("loaded")); }}
      onError={() => setState("failed")} />}
  </span>;
}
