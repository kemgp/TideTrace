import React, { useId } from "react";
import useRemoteData from "../hooks/useRemoteData.js";
import { displayTrace } from "../api/data.js";
import TraceCard from "./TraceCard.jsx";

// Appears only once it has something to show, so nothing is reserved and nothing collapses.
export default function RelatedTraces({ traceId, category, archiveSearch }) {
  const heading = useId();
  const { data, loading, error } = useRemoteData(`traces/${encodeURIComponent(traceId)}/related`, { collection: true });
  const traces = (data || []).filter((trace) => trace.id !== traceId).slice(0, 3);
  if (loading || error || !traces.length) return null;
  return <section className="trace-related" aria-labelledby={heading}>
    <h3 id={heading}>{category ? `More in ${category}` : "More from this category"}</h3>
    <div className="trace-related__grid">
      {traces.map((trace) => <TraceCard key={trace.id} trace={displayTrace(trace)} to={`/user/traces/${trace.id}`} linkState={{ archiveSearch }} />)}
    </div>
  </section>;
}
