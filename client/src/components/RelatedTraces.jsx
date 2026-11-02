import React, { useId } from "react";
import useRemoteData from "../hooks/useRemoteData.js";
import { displayTrace } from "../api/data.js";
import TraceCard from "./TraceCard.jsx";

export default function RelatedTraces({ traceId, archiveSearch }) {
  const heading = useId();
  const { data, loading, error } = useRemoteData(`traces/${encodeURIComponent(traceId)}/related`, { collection: true });
  const traces = (data || []).filter((trace) => trace.id !== traceId).slice(0, 3);
  if (error || (!loading && !traces.length)) return null;
  return <section className="trace-related" aria-labelledby={heading} aria-busy={loading || undefined}>
    <h3 id={heading}>More from this category</h3>
    <div className="trace-related__grid">{loading ? [0, 1, 2].map((key) => <div key={key} className="tcard trace-related__skeleton" aria-hidden="true"><div className="trace-card-photo trace-card-photo-loading" /><div className="remote-skeleton"><span className="remote-skeleton-line" /><span className="remote-skeleton-line" /></div></div>)
      : traces.map((trace) => <TraceCard key={trace.id} trace={displayTrace(trace)} to={`/user/traces/${trace.id}`} linkState={{ archiveSearch }} />)}</div>
  </section>;
}
