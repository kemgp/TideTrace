import React, { useEffect, useId, useRef, useState } from "react";
import { useApp } from "../context/AppContext.jsx";

export default function ReportContent({ type, targetId }) {
  const { profile } = useApp();
  return <ReportForm key={`${profile.id}:${type}:${targetId}`} type={type} targetId={targetId} />;
}

function ReportForm({ type, targetId }) {
  const { profile, writeData, readData } = useApp();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef(null);
  const field = type === "trace" ? "trace_id" : "comment_id";
  useEffect(() => () => pending.current?.abort(), []);
  async function run(check = false) {
    if (pending.current || (!check && blocked)) return;
    if (!check && !reason.trim()) { setError("Enter a reason for this report."); return; }
    const controller = new AbortController();
    pending.current = controller; setBusy(true); setError("");
    try {
      if (check) {
        const rows = await readData(`reports?${field}=${encodeURIComponent(targetId)}&status=open&limit=1`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!Array.isArray(rows) || rows.some((row) => row[field] !== targetId || row.reporter_id !== profile.id || row.status !== "open")) throw new Error("Unable to verify the saved report.");
        setBlocked(false);
        if (rows.length) { setNotice("Your report is saved and awaiting review."); setOpen(false); }
        else setError("No open report was found. You can submit again.");
      } else {
        const saved = await writeData("reports", { method: "POST", body: { [field]: targetId, reason: reason.trim() }, signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!saved?.id || saved[field] !== targetId || saved.reporter_id !== profile.id) throw Object.assign(new Error("Unable to verify the saved report."), { code: "INVALID_RESPONSE" });
        setNotice("Report submitted for review."); setOpen(false);
      }
    } catch (failure) {
      if (controller.signal.aborted || failure.code === "CANCELLED") return;
      if (!check && failure.code === "ALREADY_EXISTS") { setNotice("You already have an open report for this content."); setOpen(false); }
      else {
        const uncertain = check || failure.code === "NETWORK_ERROR" || failure.code === "INVALID_RESPONSE" || failure.status >= 500;
        setBlocked(uncertain);
        setError(uncertain ? "We could not confirm the report. Check saved status before submitting again." : failure.message);
      }
    } finally { pending.current = null; if (!controller.signal.aborted) setBusy(false); }
  }
  return <div style={{ marginBlock: 12 }}>
    {notice ? <p role="status">{notice}</p> : <button className="btn ghost sm" aria-expanded={open} onClick={() => setOpen(!open)} disabled={busy}>Report {type === "trace" ? "Trace" : "comment"}</button>}
    {open && <form aria-label={`Report ${type}`} noValidate onSubmit={(event) => { event.preventDefault(); run(); }}>
      <label className="lbl" htmlFor={inputId}>Reason for report</label>
      <textarea className="input" id={inputId} maxLength={2000} value={reason} disabled={busy || blocked} onChange={(event) => setReason(event.target.value)} />
      <button className="btn blue sm" disabled={busy || blocked}>{busy ? "Sending…" : "Submit report"}</button>
      {blocked && <button type="button" className="btn outline sm" disabled={busy} onClick={() => run(true)}>Check saved report</button>}
    </form>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
