import React, { useState } from "react";
import useRemoteData from "../hooks/useRemoteData.js";
import RemoteState, { Pagination } from "./RemoteState.jsx";

const decisions = { approved: "Approved", revision_requested: "Needs revision", rejected: "Rejected" };

export default function TraceFeedback({ id, staff = false }) {
  const [offset, setOffset] = useState(0);
  const result = useRemoteData(`${staff ? "moderation/traces" : "contributions"}/${encodeURIComponent(id)}/reviews?limit=25&offset=${offset}`, { collection: true });
  const reviews = result.data || [];
  return <section aria-label="Review feedback" style={{ marginTop: 20, marginBottom: 20 }}>
    <h3>{staff ? "Previous review feedback" : "Moderator feedback"}</h3>
    <RemoteState {...result} />
    {!result.loading && !result.error && (reviews.length ? <>
      {reviews.map((review, index) => <div className="flag" key={review.id} style={{ marginBottom: 12 }}>
        <b>{offset === 0 && index === 0 ? "Latest decision: " : "Previous decision: "}{decisions[review.to_state] || review.to_state}</b>
        <p className="hint">{new Date(review.created_at).toLocaleString()}</p>
        <p style={{ whiteSpace: "pre-wrap" }}>{review.reason || "No feedback supplied."}</p>
      </div>)}
    </> : <p className="hint">No review feedback on this page.</p>)}
    {(offset > 0 || reviews.length === 25) && <Pagination offset={offset} count={reviews.length} size={25} onChange={setOffset} loading={result.loading} />}
  </section>;
}
