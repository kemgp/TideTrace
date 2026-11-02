import React, { useCallback, useEffect, useRef, useState } from "react";
import useRemoteData from "../hooks/useRemoteData.js";
import { openPdf } from "../api/pdfDocument.js";
import "./Slides.css";

// Flip through a lesson's PDF slides one page at a time. The PDF is read in the browser, so the text
// version of the lesson stays the accessible fallback.
export default function SlidesViewer({ tideId, pages, onProgress }) {
  const link = useRemoteData(`tides/${encodeURIComponent(tideId)}/slides`, { object: true });
  const [pdf, setPdf] = useState(null);
  const [failed, setFailed] = useState("");
  const [current, setCurrent] = useState(1);
  const [width, setWidth] = useState(0);
  const canvas = useRef(null);
  const stage = useRef(null);
  const total = pdf?.pages || pages || link.data?.pages || 0;

  useEffect(() => {
    if (!link.data?.url) return undefined;
    let active = true;
    let opened;
    setFailed("");
    openPdf(link.data.url).then((document) => {
      if (!active) { document.destroy(); return; }
      opened = document; setPdf(document);
    }).catch((error) => { console.error("Slides: could not open the PDF", error); if (active) setFailed("The slides could not be loaded."); });
    return () => { active = false; opened?.destroy(); setPdf(null); };
  }, [link.data?.url]);

  useEffect(() => {
    const measure = () => setWidth(stage.current?.clientWidth || 720);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [pdf]);

  useEffect(() => {
    if (!pdf || !canvas.current || !width) return undefined;
    let task;
    let active = true;
    pdf.render(current, canvas.current, width).then((started) => {
      task = started;
      return started.promise;
    }).catch((error) => {
      if (active && error?.name !== "RenderingCancelledException") { console.error("Slides: could not draw the page", error); setFailed("The slides could not be loaded."); }
    });
    return () => { active = false; task?.cancel?.(); };
  }, [pdf, current, width]);

  useEffect(() => { if (total) onProgress?.(current / total); }, [current, total, onProgress]);
  const go = useCallback((page) => setCurrent(Math.min(Math.max(page, 1), total || 1)), [total]);
  const onKeyDown = (event) => {
    if (event.target.closest?.("button")) return;
    const keys = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 1, End: total };
    if (!(event.key in keys)) return;
    event.preventDefault();
    go(keys[event.key]);
  };

  if (link.loading) return <div className="slides" role="status" aria-busy="true">Loading slides…</div>;
  if (link.error || failed) return <div className="slides"><p role="alert">{failed || "The slides are not available. Read the text version below."}</p></div>;
  return <section className="slides" aria-label="Lesson slides" tabIndex={0} onKeyDown={onKeyDown}>
    <div className="slides-stage" ref={stage}>
      {!pdf && <p role="status" className="slides-wait">Preparing slides…</p>}
      <canvas ref={canvas} className="slides-canvas" role="img" aria-label={`Slide ${current} of ${total}`} hidden={!pdf} />
    </div>
    <div className="slides-bar" role="progressbar" aria-label="Slide progress" aria-valuemin={1} aria-valuemax={total || 1} aria-valuenow={current}><span style={{ width: `${total ? (current / total) * 100 : 0}%` }} /></div>
    <div className="slides-controls">
      <button type="button" className="btn outline sm" onClick={() => go(current - 1)} disabled={current <= 1}>Previous slide</button>
      <span className="slides-count" aria-live="polite">Slide {current} of {total}</span>
      <button type="button" className="btn outline sm" onClick={() => go(current + 1)} disabled={!total || current >= total}>Next slide</button>
    </div>
  </section>;
}
