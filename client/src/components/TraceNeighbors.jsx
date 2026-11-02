import React from "react";
import { Link } from "react-router-dom";

const LABEL = { newer: "Newer", older: "Older" };

// One arrow drawn the same way in the top buttons and the bottom cards.
function ArrowIcon({ direction, className }) {
  return <svg className={className} aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d={direction === "newer" ? "M19 12H5 M12 19l-7-7 7-7" : "M5 12h14 M12 5l7 7-7 7"} />
  </svg>;
}
const hasNeighbors = (neighbors) => Boolean(neighbors?.data?.newer || neighbors?.data?.older);

// Compact buttons beside "Back to Traces". Placeholders keep the row the same size while loading
// and when only one neighbour exists. Failed or empty results show nothing.
export function TraceStepper({ neighbors, archiveSearch }) {
  if (neighbors?.error || (!neighbors?.loading && !hasNeighbors(neighbors))) return null;
  return <nav className="trace-stepper" aria-label="Browse traces" aria-busy={neighbors?.loading || undefined}>
    {["newer", "older"].map((direction) => {
      const target = neighbors?.data?.[direction];
      const arrow = <ArrowIcon direction={direction} className="trace-stepper__arrow" />;
      const content = direction === "newer"
        ? <>{arrow}<span className="trace-stepper__label">{LABEL[direction]}</span></>
        : <><span className="trace-stepper__label">{LABEL[direction]}</span>{arrow}</>;
      return target
        ? <Link key={direction} className="btn ghost sm trace-stepper__btn" to={`/user/traces/${target.id}`} state={{ archiveSearch }}
          title={target.title} aria-label={`${LABEL[direction]} trace: ${target.title}`}>{content}</Link>
        : <span key={direction} className="btn ghost sm trace-stepper__btn is-disabled" aria-hidden="true">{content}</span>;
    })}
  </nav>;
}

// Larger cards for the end of the page, after reading the comments.
export default function TraceNeighbors({ neighbors, archiveSearch }) {
  if (!neighbors || neighbors.loading || neighbors.error || !hasNeighbors(neighbors)) return null;
  return <nav className="trace-neighbors" aria-label="More traces">
    {["newer", "older"].map((direction) => neighbors.data[direction] && <Link key={direction} className={`trace-neighbors__link trace-neighbors__link--${direction}`}
      to={`/user/traces/${neighbors.data[direction].id}`} state={{ archiveSearch }}>
      <span aria-hidden="true" className="trace-neighbors__arrow"><ArrowIcon direction={direction} /></span>
      <span className="trace-neighbors__text">
        <small>{direction === "newer" ? "Newer trace" : "Older trace"}</small>{" "}
        <span className="trace-neighbors__title" title={neighbors.data[direction].title}>{neighbors.data[direction].title}</span>
      </span>
    </Link>)}
  </nav>;
}
