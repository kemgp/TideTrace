import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";
import { ApiError } from "../../api/auth.js";
import { displayTrace } from "../../api/data.js";
import useRemoteData from "../../hooks/useRemoteData.js";
import RemoteState, { Pagination } from "../../components/RemoteState.jsx";
import TraceStatusBadge from "../../components/TraceStatusBadge.jsx";
import TraceFeedback from "../../components/TraceFeedback.jsx";
import TracePhotos from "../../components/TracePhotos.jsx";

const labels = { approved: "Approved", revision_requested: "Needs revision", rejected: "Rejected" };
const reviewBase = (role) => role === "admin" ? "/admin/review" : "/moderator/review";

export default function ReviewTraces() {
  const { id } = useParams();
  const { profile, role } = useApp();
  const base = reviewBase(role);
  return <div className="wrap" style={id ? { maxWidth: 760 } : undefined}>
    <div className="row" style={{ marginBottom: 16 }}>
      {id && <Link className="btn ghost sm" to={base}>← Back to queue</Link>}
      <Link className="btn outline sm" to={`${base}/history`}>Moderation history</Link>
    </div>
    {id ? <ReviewDetail key={`${profile.id}:${id}`} id={id} /> : <ReviewQueue key={profile.id} base={base} />}
  </div>;
}

function ReviewQueue({ base }) {
  const [offset, setOffset] = useState(0);
  const result = useRemoteData(`moderation/traces?status=pending&limit=25&offset=${offset}`, { collection: true });
  const traces = (result.data || []).map(displayTrace);
  return <>
    <div className="vhead"><span className="eyebrow teale">Review Traces</span><h2>Pending submissions</h2><p>Review the saved details and photos before approving, requesting changes, or rejecting a Trace.</p></div>
    <button className="btn outline sm" disabled={result.loading} onClick={result.retry}>Refresh queue</button>
    <RemoteState {...result} />
    {!result.loading && !result.error && (traces.length ? <div className="card" style={{ marginTop: 16 }}>
      {traces.map((trace) => <Link className="lrow click" key={trace.id} to={`${base}/${encodeURIComponent(trace.id)}`} style={{ color: "inherit", textDecoration: "none" }}>
        <div className="grow"><div className="t">{trace.title}</div><div className="m">{trace.author} · {trace.location}</div></div>
        <TraceStatusBadge status={trace.status} />
      </Link>)}
    </div> : <p className="hint">No pending submissions on this page.</p>)}
    <Pagination offset={offset} count={traces.length} size={25} onChange={setOffset} loading={result.loading} />
  </>;
}

function ReviewDetail({ id }) {
  const result = useRemoteData(`moderation/traces/${encodeURIComponent(id)}`);
  return <><RemoteState {...result} />{result.data && <Decision key={`${result.data.id}:${result.data.version}`} initialTrace={result.data} onReload={result.retry} />}</>;
}

function Decision({ initialTrace, onReload }) {
  const { profile, writeData } = useApp();
  const [current, setCurrent] = useState(initialTrace);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);
  const trace = displayTrace(current);
  const own = current.author_id === profile.id;
  const eligible = current.status === "pending" && !current.is_hidden && !current.deleted_at && !own && Number.isInteger(current.version) && current.version > 0;
  const decide = async (decision) => {
    if (request.current || blocked || !eligible) return;
    if (decision !== "approved" && !reason.trim()) { setError("Enter feedback before requesting revision or rejecting a Trace."); return; }
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    try {
      // Use the version actually reviewed, never silently upgrade to another reviewer's changes.
      const saved = await writeData(`moderation/traces/${encodeURIComponent(current.id)}/decision`, {
        method: "POST", body: { version: current.version, decision, reason: reason.trim() }, signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (saved?.id !== current.id || saved.status !== decision || !Number.isInteger(saved.version) || saved.version <= current.version) throw new ApiError("Decision response could not be verified.", "INVALID_RESPONSE");
      setCurrent({ ...current, ...saved });
      setNotice(`Decision saved: ${labels[decision]}. The pending queue and moderation history will show the saved result when opened.`);
    } catch (failure) {
      if (controller.signal.aborted || failure.code === "CANCELLED") return;
      if (failure.status === 409) {
        setBlocked(true);
        setError("This Trace changed after you opened it. Copy any feedback you want to keep, then reload the Trace and review it again.");
      } else if (failure.code === "NETWORK_ERROR" || failure.code === "INVALID_RESPONSE" || failure.status >= 500) {
        setBlocked(true);
        setError("We could not confirm the decision. Reload the Trace to check its status before trying again.");
      } else {
        if ([400, 403, 404].includes(failure.status)) setBlocked(true);
        setError(failure.message);
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      request.current = null;
    }
  };
  return <div className="card">
    <TraceStatusBadge status={trace.status} />
    <h2 style={{ marginTop: 16 }}>{trace.title}</h2>
    <p className="hint">Submitted by {trace.author}</p>
    <div className="chiprow"><span className="chip">{trace.category}</span><span className="chip">{trace.location}</span></div>
    <h3>Description</h3><p style={{ whiteSpace: "pre-wrap" }}>{trace.description}</p>
    <TracePhotos trace={current} />
    <TraceFeedback key={`${current.id}:${current.version}`} id={current.id} staff />
    {own && <p role="alert">You cannot review your own submission.</p>}
    {!own && !eligible && <p className="hint">This Trace is not awaiting a decision.</p>}
    {eligible && <section style={{ marginTop: 24 }}>
      <h3>Review decision</h3>
      <p className="hint">Approval publishes the Trace in the community archive. Revision requests ask the author for changes. Rejection is final and preserves the record in the author's contributions.</p>
      <label className="lbl" htmlFor="review-reason">Feedback (required for revision or rejection)</label>
      <textarea id="review-reason" className="input" rows={4} maxLength={2000} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} />
      <div className="row" style={{ marginTop: 16, flexWrap: "wrap" }}>
        <button className="btn teal" disabled={busy || blocked} onClick={() => decide("approved")}>Approve &amp; publish</button>
        <button className="btn clay" disabled={busy || blocked} onClick={() => decide("revision_requested")}>Request revision</button>
        <button className="btn outline" disabled={busy || blocked} onClick={() => decide("rejected")}>Reject</button>
      </div>
    </section>}
    {busy && <p role="status">Saving decision…</p>}
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert">{error}</p>}
    {blocked && <button className="btn outline" disabled={busy} onClick={onReload}>Reload Trace</button>}
  </div>;
}

export function ModerationHistory() {
  const { role } = useApp();
  const base = reviewBase(role);
  const [offset, setOffset] = useState(0);
  const result = useRemoteData(`moderation/history?limit=25&offset=${offset}`, { collection: true });
  const rows = result.data || [];
  return <div className="wrap">
    <Link className="btn ghost sm" to={base}>← Back to queue</Link>
    <div className="vhead"><h2>Moderation history</h2><p>Saved decisions and report resolutions, newest first.</p></div>
    <button className="btn outline sm" disabled={result.loading} onClick={result.retry}>Refresh history</button>
    <RemoteState {...result} />
    {!result.loading && !result.error && (rows.length ? <div className="card">{rows.map((row) => <div className="lrow" key={row.id}>
      <div className="grow">
        <div className="t">{row.trace_id ? <Link to={`${base}/${encodeURIComponent(row.trace_id)}`}>{row.trace?.title || "View reviewed Trace"}</Link> : "Reported content"}</div>
        <p>{row.action === "review_trace" ? labels[row.to_state] || row.to_state : row.action.replaceAll("_", " ")}</p>
        <p className="hint">{row.actor?.display_name || "Staff member"} · {new Date(row.created_at).toLocaleString()}</p>
        {row.reason && <p style={{ whiteSpace: "pre-wrap" }}>{row.reason}</p>}
      </div>
    </div>)}</div> : <p className="hint">No moderation history on this page.</p>)}
    <Pagination offset={offset} count={rows.length} size={25} onChange={setOffset} loading={result.loading} />
  </div>;
}
