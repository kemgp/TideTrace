import React from "react";
import { Link } from "react-router-dom";
import useRemoteData from "../hooks/useRemoteData.js";
import { displayTrace } from "../api/data.js";
import TraceThumb from "./TraceThumb.jsx";
import TraceStatusBadge from "./TraceStatusBadge.jsx";
import RelativeTime from "./RelativeTime.jsx";
import "../pages/user/contributions/contributions.css";

const LIMIT = 3;

// Traces the member can act on right now: revision requests first, then unfinished drafts.
// Renders nothing when there is nothing to do, and stays quiet if the lists cannot load
// (the totals above already report errors).
export default function NeedsAttention({ revisions = 0, drafts = 0 }) {
  const revisionResult = useRemoteData(revisions ? `contributions?limit=${LIMIT}&offset=0&status=revision_requested` : null, { collection: true });
  const draftResult = useRemoteData(drafts ? `contributions?limit=${LIMIT}&offset=0&status=draft` : null, { collection: true });
  const loading = Boolean((revisions && revisionResult.loading) || (drafts && draftResult.loading));
  const items = [...(revisionResult.data || []), ...(draftResult.data || [])].map(displayTrace).slice(0, LIMIT);
  const total = revisions + drafts;
  // While the lists load, hold the space with placeholder rows so the page does not jump.
  if (loading && !items.length) return <section aria-label="Needs your attention" aria-busy="true">
    <div className="dash-head"><h2 className="sec-t">Needs your attention</h2></div>
    <div className="attention-list" aria-hidden="true">
      {Array.from({ length: Math.min(total, LIMIT) }, (_, index) => <span key={index} className="attention-item attention-skeleton"><span className="sk" /></span>)}
    </div>
  </section>;
  if (!items.length) return null;
  return <section aria-labelledby="needs-attention-title" role="region">
    <div className="dash-head">
      <h2 className="sec-t" id="needs-attention-title">Needs your attention</h2>
      {total > items.length && <Link className="sec-link" to="/user/contributions">See all {total}</Link>}
    </div>
    <div className="attention-list">
      {items.map((t) => {
        const revision = t.status === "revision";
        const id = encodeURIComponent(t.id);
        return <Link key={t.id} className="attention-item" to={`/user/contributions/${id}${revision ? "" : "/edit"}`}>
          <TraceThumb trace={t} />
          <span className="attention-text">
            <span className="t">{t.title}</span>
            <span className="m">
              <span>{revision ? (t.note ? `Reviewer: ${t.note}` : "Reviewer asked for changes") : "Not submitted yet"}</span>
              {(t.updated_at || t.created_at) && <><span aria-hidden="true"> · </span><span>Updated <RelativeTime value={t.updated_at || t.created_at} /></span></>}
            </span>
          </span>
          <TraceStatusBadge status={t.status} />
        </Link>;
      })}
    </div>
  </section>;
}
