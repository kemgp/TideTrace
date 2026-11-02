import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import "./NavigationGuard.css";
import { useApp } from "../context/AppContext.jsx";
import useToast from "../hooks/useToast.js";

// With onOpenChange the parent owns the open state and the trigger (e.g. a menu item).
export default function ReportContent({ type, targetId, open, onOpenChange }) {
  const { profile } = useApp();
  return <ReportForm key={`${profile.id}:${type}:${targetId}`} type={type} targetId={targetId} controlledOpen={open} onOpenChange={onOpenChange} />;
}

function ReportForm({ type, targetId, controlledOpen, onOpenChange }) {
  const { profile, writeData, readData } = useApp();
  const inputId = useId();
  const [innerOpen, setInnerOpen] = useState(false);
  const controlled = onOpenChange !== undefined;
  const open = controlled ? Boolean(controlledOpen) : innerOpen;
  const setOpen = controlled ? onOpenChange : setInnerOpen;
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();
  const [reported, setReported] = useState(false);
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
        if (rows.length) { toast.info("Your report is saved and awaiting review."); setReported(true); setOpen(false); }
        else setError("No open report was found. You can submit again.");
      } else {
        const saved = await writeData("reports", { method: "POST", body: { [field]: targetId, reason: reason.trim() }, signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!saved?.id || saved[field] !== targetId || saved.reporter_id !== profile.id) throw Object.assign(new Error("Unable to verify the saved report."), { code: "INVALID_RESPONSE" });
        toast.success("Report submitted for review."); setReported(true); setOpen(false);
      }
    } catch (failure) {
      if (controller.signal.aborted || failure.code === "CANCELLED") return;
      if (!check && failure.code === "ALREADY_EXISTS") { toast.info("You already have an open report for this content."); setReported(true); setOpen(false); }
      else {
        const uncertain = check || failure.code === "NETWORK_ERROR" || failure.code === "INVALID_RESPONSE" || failure.status >= 500;
        setBlocked(uncertain);
        setError(uncertain ? "We could not confirm the report. Check saved status before submitting again." : failure.message);
      }
    } finally { pending.current = null; if (!controller.signal.aborted) setBusy(false); }
  }
  return <div className="report-content">
    {!controlled && <button type="button" className="btn ghost sm report-link" aria-haspopup="dialog" onClick={() => setOpen(true)} disabled={busy || reported}>{reported ? "Reported" : `Report ${type === "trace" ? "Trace" : "comment"}`}</button>}
    {open && <ReportDialog title={type === "trace" ? "Report this trace" : "Report this comment"} busy={busy} onClose={() => setOpen(false)}>
      <form aria-label={`Report ${type}`} noValidate onSubmit={(event) => { event.preventDefault(); run(); }}>
        <label className="lbl" htmlFor={inputId}>Reason for report</label>
        <textarea className="input report-dialog__reason" id={inputId} maxLength={2000} value={reason} autoFocus disabled={busy || blocked} onChange={(event) => setReason(event.target.value)} />
        {error && <p role="alert">{error}</p>}
        <div className="leave-dialog-actions">
          <button type="button" className="btn outline sm" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
          {blocked && <button type="button" className="btn outline sm" disabled={busy} onClick={() => run(true)}>Check saved report</button>}
          <button className="btn blue sm" disabled={busy || blocked}>{busy ? "Sending…" : "Submit report"}</button>
        </div>
      </form>
    </ReportDialog>}
    {!open && error && <p role="alert">{error}</p>}
  </div>;
}

function ReportDialog({ title, busy, onClose, children }) {
  const dialog = useRef(null);
  const heading = useId();
  useLayoutEffect(() => {
    const element = dialog.current;
    // Browsers get a true modal; environments without it still show the dialog.
    if (typeof element.showModal === "function") element.showModal(); else element.setAttribute("open", "");
    return () => { if (typeof element.close === "function") element.close(); else element.removeAttribute("open"); };
  }, []);
  return <dialog ref={dialog} className="leave-dialog report-dialog" aria-labelledby={heading}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <h2 id={heading}>{title}</h2>
    {children}
  </dialog>;
}
