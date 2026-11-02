import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

// A thin bar at the top of the window showing how far through the lesson text you have scrolled.
// `targetRef` is the lesson element. Decorative: the page text carries the meaning.
export default function ReadingProgress({ targetRef, value: fixed }) {
  const bar = useRef(null);
  // A lesson with slides passes `value` (0 to 1) so the bar follows the slides instead of the page scroll.
  useEffect(() => {
    if (typeof fixed === "number") { if (bar.current) bar.current.style.transform = `scaleX(${Math.min(1, Math.max(0, fixed))})`; return undefined; }
    let frame = 0;
    const update = () => {
      frame = 0;
      const target = targetRef.current;
      if (!target || !bar.current) return;
      const rect = target.getBoundingClientRect();
      const distance = rect.height - window.innerHeight;
      const value = distance <= 0 ? (rect.bottom <= window.innerHeight ? 1 : 0) : Math.min(1, Math.max(0, -rect.top / distance));
      bar.current.style.transform = `scaleX(${value})`;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => { window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); if (frame) cancelAnimationFrame(frame); };
  }, [targetRef, fixed]);
  // Rendered on <body>: an animated or transformed page wrapper would otherwise turn "fixed" into "relative to the wrapper".
  return createPortal(<div className="reading-progress" aria-hidden="true"><span ref={bar} /></div>, document.body);
}
