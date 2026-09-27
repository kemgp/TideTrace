import React, { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";
import useRemoteData from "../../hooks/useRemoteData.js";
import RemoteState, { Pagination } from "../../components/RemoteState.jsx";
import TracePhotos from "../../components/TracePhotos.jsx";

export default function ManageReports() {
  const { profile } = useApp();
  return <ReportQueue key={profile.id} />;
}

function ReportQueue() {
  const { role } = useApp();
  const [status, setStatus] = useState("open");
  const [offset, setOffset] = useState(0);
  const result = useRemoteData(`moderation/reports?status=${status}&limit=25&offset=${offset}`, { collection: true });
  const reports = result.data || [];
  return <div className="wrap" style={{ maxWidth: 800 }}>
    <div className="vhead"><span className="eyebrow teale">Manage reports</span><h2>Reported content</h2><p>Review the content and report reason. Dismissing keeps the content; removing hides it from public views. Every decision requires a reason and is saved in moderation history.</p></div>
    <div className="row" style={{ flexWrap: "wrap" }}>
      <label>Report status <select className="input" aria-label="Report status" value={status} onChange={(event) => { setStatus(event.target.value); setOffset(0); }}>
        <option value="open">Open</option><option value="resolved">Resolved — content removed</option><option value="dismissed">Dismissed</option>
      </select></label>
      <button className="btn outline sm" disabled={result.loading} onClick={result.retry}>Refresh reports</button>
      <Link className="btn ghost sm" to={`/${role === "admin" ? "admin" : "moderator"}/review/history`}>Moderation history</Link>
    </div>
    <RemoteState {...result} />
    {!result.loading && !result.error && (reports.length ? reports.map((report) => <ReportDecision key={`${report.id}:${report.status}`} initialReport={report} />) : <p>No {status} reports on this page.</p>)}
    <Pagination offset={offset} count={reports.length} size={25} onChange={setOffset} loading={result.loading || Boolean(result.error)} />
  </div>;
}

function ReportDecision({ initialReport }) {
  const { writeData, readData } = useApp();
  const inputId = useId();
  const [report, setReport] = useState(initialReport);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function run(removeContent, reload = false) {
    if (pending.current || (!reload && (blocked || report.status !== "open"))) return;
    if (!reload && !reason.trim()) { setError("Enter a reason for your decision."); return; }
    const controller = new AbortController();
    pending.current = controller; setBusy(true); setError(""); setNotice("");
    try {
      if (!reload) {
        const response = await writeData(`moderation/reports/${encodeURIComponent(report.id)}/resolve`, { method: "POST", body: { remove_content: removeContent, reason: reason.trim() }, signal: controller.signal });
        if (controller.signal.aborted) return;
        if (response !== null) throw new Error("The decision response could not be verified.");
      }
      const saved = await readData(`moderation/reports/${encodeURIComponent(report.id)}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (saved?.id !== report.id || !["open", "resolved", "dismissed"].includes(saved.status)) throw new Error("The saved decision could not be verified.");
      if (!reload && saved.status !== (removeContent ? "resolved" : "dismissed")) throw new Error("The saved decision could not be verified.");
      setReport(saved); setBlocked(false);
      setNotice(reload ? "Saved report reloaded." : removeContent ? "Content removed. Decision saved." : "Report dismissed. Decision saved.");
    } catch (failure) {
      if (controller.signal.aborted || failure.code === "CANCELLED") return;
      // A concurrent reviewer or a lost response may have closed the report.
      setBlocked(true); setError(`${failure.message} Reload the saved report before taking another action.`);
    } finally { pending.current = null; if (!controller.signal.aborted) setBusy(false); }
  }
  const title = report.trace?.title || report.comment?.trace?.title || "Unavailable Trace";
  return <article className="card" style={{ marginTop: 16, overflowWrap: "anywhere" }} aria-label={`Report: ${title}`}>
    <h3>{report.trace_id ? "Trace" : "Comment"}: {title}</h3>
    <p className="hint">Reported by {report.reporter?.display_name || "Community member"}{report.created_at ? ` · ${new Date(report.created_at).toLocaleString()}` : ""}</p>
    <p><b>Report reason:</b> {report.reason}</p>
    <details><summary>View reported content</summary>
      {report.trace_id ? report.trace ? <><p style={{ whiteSpace: "pre-wrap" }}>{report.trace.description}</p><TracePhotos trace={report.trace} /><p>{report.trace.is_hidden || report.trace.deleted_at ? "This Trace is already hidden or deleted." : "This Trace is visible."}</p></> : <p>Content is no longer available.</p>
        : report.comment ? <><p style={{ whiteSpace: "pre-wrap" }}>{report.comment.body}</p><p>Comment status: {report.comment.status}</p></> : <p>Content is no longer available.</p>}
    </details>
    <p><b>Status:</b> {report.status === "resolved" ? "Resolved — content removed" : report.status === "dismissed" ? "Dismissed" : "Open"}</p>
    {report.status === "open" ? <form noValidate onSubmit={(event) => event.preventDefault()}>
      <fieldset disabled={busy || blocked} style={{ border: 0, padding: 0 }}>
        <label className="lbl" htmlFor={inputId}>Decision reason</label>
        <textarea className="input" id={inputId} maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} />
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" className="btn outline sm" onClick={() => run(false)}>Dismiss report</button>
          <button type="button" className="btn clay sm" onClick={() => run(true)}>Remove content</button>
        </div>
      </fieldset>
    </form> : <><p><b>Decision reason:</b> {report.resolution_reason}</p><p className="hint">{report.resolver?.display_name || "Staff member"}{report.resolved_at ? ` · ${new Date(report.resolved_at).toLocaleString()}` : ""}</p></>}
    {busy && <p role="status">Checking saved decision…</p>}
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {blocked && <button className="btn outline sm" disabled={busy} onClick={() => run(false, true)}>Reload saved report</button>}
  </article>;
}
