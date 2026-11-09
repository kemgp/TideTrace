import { PAGE_SIZE } from "../../api/pagination.js";
import React, { useEffect, useId, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";
import useRemoteData from "../../hooks/useRemoteData.js";
import RemoteState, { Pagination } from "../../components/RemoteState.jsx";
import Button from "../../components/Button.jsx";
import PageHeader from "../../components/PageHeader.jsx";
import TracePhotos from "../../components/TracePhotos.jsx";
import { ReviewSwitch } from "../../components/StaffSwitches.jsx";
import { ConfirmDialog, REPORT_REASONS, ReasonPicker, useReasonTemplates } from "./modTools.jsx";

// One view for reported Traces and reported comments. The type filter lives in the URL (?type=trace|comment)
// so links such as the old comments page address keep working.
const TYPES = [["", "All"], ["trace", "Traces"], ["comment", "Comments"]];

export default function ManageReports() {
  const { profile } = useApp();
  return <ReportQueue key={profile.id} />;
}

function ReportQueue() {
  const { role, writeData } = useApp();
  const [params, setParams] = useSearchParams();
  const type = ["trace", "comment"].includes(params.get("type")) ? params.get("type") : "";
  const [status, setStatus] = useState("open");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState([]);
  const [bulk, setBulk] = useState(false);
  const [bulkReason, setBulkReason] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [bulkNotice, setBulkNotice] = useState("");
  const keepTemplates = useReasonTemplates("report");
  const result = useRemoteData(`moderation/reports?status=${status}&limit=${PAGE_SIZE}&offset=${offset}${type ? `&type=${type}` : ""}`, { collection: true });
  const reports = result.data || [];
  const targetKey = (report) => report.trace_id ? `t:${report.trace_id}` : `c:${report.comment_id}`;
  // Open reports on the same Trace or comment are decided together, as one card.
  const groups = status === "open" ? Object.values(reports.reduce((map, report) => { const key = targetKey(report); (map[key] ||= []).push(report); return map; }, {})) : reports.map((report) => [report]);
  const changeType = (value) => { setParams(value ? { type: value } : {}, { replace: true }); setOffset(0); setSelected([]); setBulk(false); };
  const toggleGroup = (ids) => setSelected((list) => ids.every((id) => list.includes(id)) ? list.filter((id) => !ids.includes(id)) : [...new Set([...list, ...ids])]);
  const dismissSelected = async () => {
    if (bulkBusy || !bulkReason.trim() || !selected.length) return;
    setBulkBusy(true); setBulkError("");
    try {
      const response = await writeData("moderation/reports/resolve", { method: "POST", body: { ids: selected, remove_content: false, reason: bulkReason.trim() } });
      if (!response || response.resolved !== selected.length) throw new Error("The decisions could not be verified.");
      setBulkNotice(`${response.resolved} ${response.resolved === 1 ? "report" : "reports"} dismissed. Decisions saved.`);
      setSelected([]); setBulk(false); setBulkReason("");
      result.retry();
    } catch (failure) {
      setBulk(false);
      setBulkError(`${failure.message} Refresh the list to see what was saved.`);
    } finally { setBulkBusy(false); }
  };
  return <>
    <PageHeader eyebrow="Manage reports" title="Reported content" subtitle="Review the content and report reason. Dismissing keeps the content; removing hides it from public views. Every decision requires a reason and is saved in moderation history."><ReviewSwitch /></PageHeader>
    <div className="page-body mod-reports-page">
    <div className="card mod-report-tools">
      <div className="mod-report-tools__filters">
      <div className="archive-view-switch" role="group" aria-label="Report type">
        {TYPES.map(([value, label]) => <Button key={label} type="button" variant="ghost" size="sm" aria-pressed={type === value} onClick={() => changeType(value)}>{label}</Button>)}
      </div>
      <div className="archive-view-switch" role="group" aria-label="Report status">
        {[["open", "Open"], ["resolved", "Removed"], ["dismissed", "Dismissed"]].map(([value, label]) => <Button key={value} type="button" variant="ghost" size="sm" aria-pressed={status === value} onClick={() => { setStatus(value); setOffset(0); setSelected([]); }}>{label}{value === "open" && status === "open" && reports.length ? ` (${groups.length})` : ""}</Button>)}
      </div>
      </div>
      <div className="mod-report-tools__side">
        <span className="hint">Oldest first</span>
        <button className="btn outline sm" disabled={result.loading} onClick={result.retry}>Refresh</button>
        {role === "admin" && <Link className="btn ghost sm" to="/admin/review/history">Moderation history</Link>}
      </div>
    </div>
    {status === "open" && selected.length > 0 && <div className="bulk-bar" role="region" aria-label="Selected reports"><span>{selected.length} selected</span><span className="bulk-bar__note">Dismiss several at once with one shared reason. Removing stays one card at a time.</span><button type="button" className="btn outline sm" onClick={() => setSelected([])}>Clear</button><button type="button" className="btn blue sm" onClick={() => { setBulkError(""); setBulk(true); }}>Dismiss selected</button></div>}
    {bulkNotice && <p role="status">{bulkNotice}</p>}
    {bulkError && <p role="alert">{bulkError}</p>}
    {bulk && <ConfirmDialog title={`Dismiss ${selected.length} ${selected.length === 1 ? "report" : "reports"}?`} confirmLabel="Dismiss reports" confirmClass="blue" busy={bulkBusy} disabled={!bulkReason.trim()} onCancel={() => setBulk(false)} onConfirm={dismissSelected}>
      <p>The content stays visible. Everyone who reported it is told, and your reason is saved in moderation history.</p>
      <label className="lbl" htmlFor="bulk-reason">Reason</label>
      <textarea id="bulk-reason" className="input" rows={3} maxLength={2000} value={bulkReason} onChange={(event) => setBulkReason(event.target.value)} />
      <ReasonPicker options={REPORT_REASONS} templates={keepTemplates} value={bulkReason} disabled={bulkBusy} onPick={setBulkReason} />
    </ConfirmDialog>}
    <RemoteState {...result} />
    {!result.loading && !result.error && (reports.length ? groups.map((group) => <ReportDecision key={group.map((report) => `${report.id}:${report.status}`).join("|")} initialReport={group[0]} group={group} templates={keepTemplates} selected={group.every((report) => selected.includes(report.id))} onToggle={() => toggleGroup(group.map((report) => report.id))} onChanged={(message) => { if (message) setBulkNotice(message); result.retry(); }} />) : <p>No {status} {type === "comment" ? "comment reports" : type === "trace" ? "Trace reports" : "reports"} on this page.</p>)}
    <Pagination offset={offset} count={reports.length} size={PAGE_SIZE} onChange={setOffset} loading={result.loading || Boolean(result.error)} />
    </div>
  </>;
}

function ReportDecision({ initialReport, group, templates, selected = false, onToggle, onChanged }) {
  const reports = group?.length ? group : [initialReport];
  const groupSize = reports.length;
  const { writeData, readData } = useApp();
  const [confirmRemove, setConfirmRemove] = useState(false);
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
      if (!reload && groupSize > 1) {
        // Every report on this content is decided together, with one reason.
        const response = await writeData("moderation/reports/resolve", { method: "POST", body: { ids: reports.map((item) => item.id), remove_content: removeContent, reason: reason.trim() }, signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!response || response.resolved !== groupSize) throw new Error("The decisions could not be verified.");
        setReport({ ...report, status: removeContent ? "resolved" : "dismissed", resolution_reason: reason.trim() }); setBlocked(false);
        // The queue reloads after a group decision, which replaces this card, so the queue shows the confirmation.
        const message = removeContent ? "Content removed. Decisions saved." : "Reports dismissed. Decisions saved.";
        if (onChanged) onChanged(message); else setNotice(message);
        return;
      }
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
  const isComment = Boolean(report.comment_id);
  const title = report.trace?.title || report.comment?.trace?.title || "Unavailable Trace";
  return <article className="card mod-report-card" style={{ marginTop: 16, overflowWrap: "anywhere" }} aria-label={`Report: ${title}`}>
    <header className="mod-report-header">
      {report.status === "open" && onToggle && <input type="checkbox" className="mod-report-select" checked={selected} onChange={onToggle} aria-label={`Select report on ${title}`} />}
      <div>
        <h3>{report.trace_id ? "Trace" : "Comment"}: {title}</h3>
        
        <p className="hint">{report.comment_id ? "Comment" : "Trace"} by {(report.comment_id ? report.comment?.author : report.trace?.author)?.display_name || "Unavailable member"}</p>
      </div>
      {groupSize > 1 && <span className="group-badge">{groupSize} reports</span>}
      <span className={`badge ${report.status === "resolved" ? "removed" : report.status}`}>{report.status === "resolved" ? "Removed" : report.status === "dismissed" ? "Dismissed" : "Open"}</span>
    </header>
    <p className="hint mod-report-meta">Reported by {report.reporter?.display_name || "Community member"}{groupSize > 1 ? ` and ${groupSize - 1} ${groupSize === 2 ? "other" : "others"}` : ""}{report.created_at ? <> · <time dateTime={report.created_at} title={new Date(report.created_at).toLocaleString()}>{new Date(report.created_at).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</time></> : ""}</p>
    <div className="mod-report-reason"><span className="mod-report-label">Report reason</span>{groupSize > 1 ? <ul>{reports.map((item) => <li key={item.id}>{item.reason}</li>)}</ul> : <p>{report.reason}</p>}</div>
    <details><summary>View reported content</summary>
      {report.trace_id ? report.trace ? <><p style={{ whiteSpace: "pre-wrap" }}>{report.trace.description}</p><TracePhotos trace={report.trace} /><p>{report.trace.is_hidden || report.trace.deleted_at ? "This Trace is already hidden or deleted." : "This Trace is visible."}</p></> : <p>Content is no longer available.</p>
        : report.comment ? <><p style={{ whiteSpace: "pre-wrap" }}>{report.comment.body}</p><p>Comment status: {report.comment.status}</p></> : <p>Content is no longer available.</p>}
    </details>
    {report.status === "open" ? <form className="mod-report-decision" noValidate onSubmit={(event) => event.preventDefault()}>
      <fieldset disabled={busy || blocked} style={{ border: 0, padding: 0 }}>
        <h4>Review decision</h4>
        <p className="hint" id={`${inputId}-help`}>Explain your decision. It’s saved in moderation history.</p>
        <label className="lbl" htmlFor={inputId}>Decision reason</label>
        <textarea className="input" id={inputId} aria-describedby={`${inputId}-help`} placeholder="Briefly explain why you’re keeping or removing this content…" maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} />
        <ReasonPicker options={REPORT_REASONS} templates={templates} value={reason} disabled={busy || blocked} onPick={setReason} />
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" className="btn outline sm" onClick={() => run(false)}>{isComment ? "Keep comment" : "Dismiss report"}</button>
          <button type="button" className="btn danger sm" onClick={() => { if (!reason.trim()) { setError("Enter a reason for your decision."); return; } setError(""); setConfirmRemove(true); }}>{isComment ? "Remove comment" : "Remove content"}</button>
        </div>
      </fieldset>
    </form> : <section className={`mod-report-outcome ${report.status}`} aria-label="Saved decision">
      <h4>{report.status === "resolved" ? `${report.comment_id ? "Comment" : "Content"} removed` : "Report dismissed"}</h4>
      <p className="mod-outcome-description">{report.status === "resolved" ? "Removal recorded for this report." : "No removal was requested for this report."}</p>
      <span className="mod-report-label">Decision reason</span>
      <p className="mod-outcome-reason">{report.resolution_reason || "No reason recorded."}</p>
      <p className="hint">Reviewed by {report.resolver?.display_name || "Staff member"}{report.resolved_at ? <> · <time dateTime={report.resolved_at} title={new Date(report.resolved_at).toLocaleString()}>{new Date(report.resolved_at).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</time></> : ""}</p>
    </section>}
    {confirmRemove && <ConfirmDialog title={isComment ? "Remove this comment?" : "Remove this content?"} confirmLabel="Yes, remove" busy={busy} onCancel={() => setConfirmRemove(false)} onConfirm={() => { setConfirmRemove(false); run(true); }}>
      <p>It is hidden from public views and its author is told. Everyone who reported it is also told the outcome.</p>
      <p className="mod-dialog__quote">{reason.trim()}</p>
    </ConfirmDialog>}
    {busy && <p role="status">Checking saved decision…</p>}
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {blocked && <button className="btn outline sm" disabled={busy} onClick={() => run(false, true)}>Reload saved report</button>}
  </article>;
}
