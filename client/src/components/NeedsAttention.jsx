import React from "react";
import { Link } from "react-router-dom";
import useRemoteData from "../hooks/useRemoteData.js";
import { displayTrace } from "../api/data.js";
import { waitingText } from "../api/dashboardText.js";
import TraceThumb from "./TraceThumb.jsx";
import TraceStatusBadge from "./TraceStatusBadge.jsx";
import RelativeTime from "./RelativeTime.jsx";
import "../pages/user/contributions/contributions.css";

const LIMIT = 3;

// Traces the member can act on right now: revision requests first (longest-waiting first), then unfinished drafts.
// Renders nothing when there is nothing to do, and stays quiet if the lists cannot load
// (the totals above already report errors). The hero link "Fix N revisions" scrolls here.
export default function NeedsAttention({ revisions = 0, drafts = 0 }) {
  const revisionResult = useRemoteData(revisions ? `contributions?limit=${LIMIT}&offset=0&status=revision_requested` : null, { collection: true });
  const draftResult = useRemoteData(drafts ? `contributions?limit=${LIMIT}&offset=0&status=draft` : null, { collection: true });
  const loading = Boolean((revisions && revisionResult.loading) || (drafts && draftResult.loading));
  const waitingSince = (trace) => new Date(trace.revision_requested_at || trace.updated_at || trace.created_at).getTime() || 0;
  const revisionRows = (revisionResult.data || []).map(displayTrace).sort((a, b) => waitingSince(a) - waitingSince(b));
  const items = [...revisionRows, ...(draftResult.data || []).map(displayTrace)].slice(0, LIMIT);
  const total = revisions + drafts;
  // While the lists load, hold the space with placeholder rows so the page does not jump.
  if (loading && !items.length) return <section id="needs-attention" className="dash-attention" aria-label="Needs your attention" aria-busy="true">
    <div className="dash-head"><h2 className="sec-t">Needs your attention</h2></div>
    <div className="attention-list" aria-hidden="true">
      {Array.from({ length: Math.min(total, LIMIT) }, (_, index) => <span key={index} className="attention-item attention-skeleton"><span className="sk" /></span>)}
    </div>
  </section>;
  if (!items.length) return null;
  return <section id="needs-attention" className="dash-attention" tabIndex={-1} aria-labelledby="needs-attention-title" role="region">
    <div className="dash-head">
      <h2 className="sec-t" id="needs-attention-title">Needs your attention</h2>
      {total > items.length && <Link className="sec-link" to="/user/contributions">See all {total}</Link>}
    </div>
    <div className="attention-list">
      {items.map((t) => {
        const revision = t.status === "revision";
        const id = encodeURIComponent(t.id);
        const note = revision ? (t.reviewer_note || t.note || "").trim() : "";
        const action = revision ? "Revise" : "Finish draft";
        // One link per row: the visible action button. Its box is stretched over the row so the whole row opens the same place.
        return <div key={t.id} className="attention-item">
          <TraceThumb trace={t} />
          <span className="attention-text">
            <span className="t">{t.title}</span>
            {revision && <span className="m attention-note">{note ? `Reviewer: ${note}` : "Reviewer asked for changes"}</span>}
            <span className="m">
              {revision
                ? <span>{waitingText(t.revision_requested_at || t.updated_at || t.created_at)}</span>
                : <><span>Not submitted yet</span>{(t.updated_at || t.created_at) && <><span aria-hidden="true"> · </span><span>Updated <RelativeTime value={t.updated_at || t.created_at} /></span></>}</>}
            </span>
          </span>
          <TraceStatusBadge status={t.status} />
          <Link className={`btn ${revision ? "blue" : "outline"} sm attention-action`} to={`/user/contributions/${id}/edit`} aria-label={`${action}: ${t.title}`}>{action}</Link>
        </div>;
      })}
    </div>
  </section>;
}
