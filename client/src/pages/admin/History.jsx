import { PAGE_SIZE } from "../../api/pagination.js";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import useRemoteData from "../../hooks/useRemoteData.js";
import RemoteState, { Pagination } from "../../components/RemoteState.jsx";

const filters = ["All", "Approved", "Revision", "Rejected", "Kept", "Removed", "Dismissed"];
function outcome(row) {
  if (row.action === "review_trace") return { approved: "Approved", revision_requested: "Revision", rejected: "Rejected" }[row.to_state] || row.to_state;
  if (row.action === "review_report") return row.to_state === "resolved" ? "Removed" : "Dismissed";
  return { visible: "Kept", kept: "Kept", hidden: "Removed", removed: "Removed", dismissed: "Dismissed" }[row.to_state] || row.to_state;
}
export default function History() {
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState("All");
  const result = useRemoteData(`moderation/history?limit=${PAGE_SIZE + 1}&offset=${offset}${filter === "All" ? "" : `&outcome=${filter.toLowerCase()}`}`, { collection: true });
  const rows = result.data || [];
  const filtered = rows.slice(0, PAGE_SIZE);
  return <div className="wrap">
    <div className="vhead headrow"><div><span className="eyebrow claye">Trace moderation history</span><h2>Every decision, on record</h2><p>Audit saved moderation decisions, with the reviewer, date, and feedback recorded for each action.</p></div><div className="row"><Link className="btn outline sm" to="/admin/review">Review Traces</Link><Link className="btn outline sm" to="/admin/reports">Reports</Link></div></div>
    <div className="chiprow" aria-label="Filter moderation history">{filters.map((label) => <button className={`chip ${filter === label ? "on" : ""}`} aria-pressed={filter === label} key={label} onClick={() => { setFilter(label); setOffset(0); }}>{label}</button>)}</div>
    <div className="admin-history-tools"><span className="hint">Filters apply to all saved decisions.</span><button className="btn ghost sm" disabled={result.loading} onClick={result.retry}>Refresh history</button></div>
    <RemoteState {...result} />
    {!result.loading && !result.error && <div className="card admin-history-list">{filtered.length ? filtered.map((row) => {
      const decision = outcome(row);
      const title = row.trace?.title || row.report?.trace?.title || (row.comment || row.report?.comment ? "Reported comment" : "Reported content");
      const comment = row.comment || row.report?.comment;
      const author = comment ? comment.author : (row.trace || row.report?.trace)?.author;
      return <div className="lrow" key={row.id}><div className="grow"><div className="t">{title}</div><p className="hint">{comment ? "Comment" : "Trace"} by {author?.display_name || "Unavailable member"}</p>{row.report && <p className="hint">Reported by {row.report.reporter?.display_name || "Unavailable member"}</p>}<div className="m">Reviewed by {row.actor?.display_name || "Staff member"} · {new Date(row.created_at).toLocaleString()}</div>{row.reason && <p className="hint admin-history-reason">{row.reason}</p>}</div><span className={`badge ${decision === "Approved" || decision === "Kept" ? "approved" : decision === "Revision" ? "revision" : "removed"}`}>{decision === "Revision" ? "Revision requested" : decision}</span>{row.trace_id && row.action === "review_trace" && <Link className="mini outline" to={`/admin/review/${encodeURIComponent(row.trace_id)}`}>View trace</Link>}</div>;
    }) : <p className="hint">No {filter === "All" ? "moderation" : filter.toLowerCase()} decisions on this page.</p>}</div>}
    <Pagination offset={offset} count={filtered.length} hasNext={rows.length > PAGE_SIZE} size={PAGE_SIZE} onChange={setOffset} loading={result.loading || Boolean(result.error)} />
  </div>;
}
