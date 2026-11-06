import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import useRemoteData from "../../hooks/useRemoteData.js";

// Quick reasons: the chip shows a short label, choosing it fills the box with the full sentence.
export const REVIEW_REASONS = [
  { label: "Location too precise", text: "Please blur the pin so it is not exact. A nearby landmark is enough." },
  { label: "Photo is unclear", text: "Please add a clearer photo of what you observed." },
  { label: "Needs more detail", text: "Please describe what you saw in more detail." },
  { label: "Contains a person", text: "Please retake or crop the photo so no one can be identified." },
  { label: "Not a coastal observation", text: "This is not a coastal or marine observation." },
  { label: "Duplicate", text: "This duplicates an existing Trace." },
];
export const REPORT_REASONS = [
  { label: "Person not identifiable", text: "No one can be identified in the photo, so it stays." },
  { label: "Pin is approximate", text: "The pin is approximate, not an exact spot, so it stays." },
  { label: "Photo contains a person", text: "The photo clearly shows a person who has not agreed to it." },
  { label: "Location too precise", text: "The exact location could put a sensitive place at risk." },
  { label: "Breaks the guidelines", text: "This breaks the community guidelines." },
  { label: "Spam or advertising", text: "This is spam or advertising." },
];
export const MAX_SAVED_REASONS = 30;

// How long a Trace has been waiting, in whole days, as a short label.
export function waitLabel(submittedAt, now = Date.now()) {
  const time = Date.parse(submittedAt || "");
  if (!Number.isFinite(time)) return "";
  const days = Math.floor((now - time) / 86400000);
  if (days < 1) return "Waiting today";
  return `Waiting ${days} ${days === 1 ? "day" : "days"}`;
}
export const waitTone = (submittedAt, now = Date.now()) => {
  const time = Date.parse(submittedAt || "");
  if (!Number.isFinite(time)) return "";
  const days = (now - time) / 86400000;
  return days >= 14 ? "is-late" : days >= 7 ? "is-aging" : "";
};

// A moderator's saved reasons for one kind of decision, loaded once per page.
export function useReasonTemplates(kind) {
  const { writeData } = useApp();
  const result = useRemoteData(`moderation/reason-templates?kind=${kind}`, { collection: true });
  const [error, setError] = useState("");
  const items = result.data || [];
  const save = useCallback(async (body) => {
    setError("");
    try {
      await writeData("moderation/reason-templates", { method: "POST", body: { kind, body: body.trim().slice(0, 500) } });
      result.retry();
      return true;
    } catch (failure) { setError(failure.message || "The reason could not be saved."); return false; }
  }, [kind, writeData, result.retry]);
  const remove = useCallback(async (id) => {
    setError("");
    try { await writeData(`moderation/reason-templates/${encodeURIComponent(id)}`, { method: "DELETE" }); result.retry(); }
    catch (failure) { setError(failure.message || "The reason could not be deleted."); }
  }, [writeData, result.retry]);
  return { items, save, remove, error, loading: result.loading };
}

// Quick-pick chips plus the moderator's own saved reasons. Choosing one fills the box; they can still edit it.
export function ReasonPicker({ options, templates, value, onPick, disabled }) {
  const heading = useId();
  const saved = templates?.items || [];
  const text = value.trim();
  const canSave = text.length >= 3 && text.length <= 500 && !saved.some((item) => item.body === text) && saved.length < MAX_SAVED_REASONS;
  return <div className="reason-picker">
    <p className="reason-picker__label" id={heading}>Quick reasons</p>
    <div className="reason-picker__chips" role="group" aria-labelledby={heading}>
      {options.map((option) => <button type="button" key={option.label} className="reason-chip" disabled={disabled} onClick={() => onPick(option.text)}>{option.label}</button>)}
      {saved.map((item) => <span className="reason-chip reason-chip--saved" key={item.id}>
        <button type="button" disabled={disabled} onClick={() => onPick(item.body)}>{item.body}</button>
        <button type="button" className="reason-chip__remove" disabled={disabled} aria-label={`Delete saved reason: ${item.body}`} onClick={() => templates.remove(item.id)}>×</button>
      </span>)}
    </div>
    {canSave && <button type="button" className="btn ghost sm" disabled={disabled} onClick={() => templates.save(text)}>Save this as a reason</button>}
    {saved.length >= MAX_SAVED_REASONS && <p className="hint">You have saved the most reasons allowed (30). Delete one to add another.</p>}
    {templates?.error && <p role="alert">{templates.error}</p>}
  </div>;
}

// A small modal used to confirm Reject and Remove, and to ask for a hold reason.
export function ConfirmDialog({ title, children, confirmLabel, confirmClass = "danger", busy, disabled, onConfirm, onCancel }) {
  const titleId = useId();
  const box = useRef(null);
  const cancel = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    cancel.current?.focus();
    return () => { if (previous instanceof HTMLElement) previous.focus(); };
  }, []);
  const keys = (event) => {
    if (event.key === "Escape") { event.stopPropagation(); if (!busy) onCancel(); return; }
    if (event.key !== "Tab") return;
    const controls = [...box.current.querySelectorAll("button:not(:disabled),textarea,input,select")];
    if (!controls.length) return;
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  return <div className="mod-dialog-overlay" onKeyDown={keys}>
    <div className="mod-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={box}>
      <h3 id={titleId}>{title}</h3>
      {children}
      <div className="row mod-dialog__actions">
        <button type="button" ref={cancel} className="btn outline" disabled={busy} onClick={onCancel}>Cancel</button>
        <button type="button" className={`btn ${confirmClass}`} disabled={busy || disabled} aria-busy={busy || undefined} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </div>
  </div>;
}

// What the team already knows about this author, so a decision has context.
export function AuthorCard({ authorId, name }) {
  const result = useRemoteData(authorId ? `moderation/authors/${encodeURIComponent(authorId)}/summary` : null, { object: true });
  const data = result.data;
  if (!data || Array.isArray(data) || typeof data.traces !== "number") return null;
  const stats = [["Traces", data.traces], ["Approved", data.approved], ["Needed changes", data.needed_changes], ["Reports against", data.reports_against]];
  return <section className="author-card" aria-label={`About ${name || "this author"}`}>
    <h3>About {name || "this author"}</h3>
    <dl>{stats.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{Number.isFinite(value) ? value : 0}</dd></div>)}</dl>
  </section>;
}

// True when a key press should not trigger a shortcut (typing, dialogs, modifier keys).
export function shortcutBlocked(event) {
  if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return true;
  const target = event.target;
  if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(target.tagName))) return true;
  return Boolean(document.querySelector('[role="dialog"][aria-modal="true"]'));
}

// Pills on a queue card: open reports and how long the Trace has waited.
export function QueueBadges({ trace }) {
  const waited = waitLabel(trace.submitted_at);
  return <>
    {trace.report_count > 0 && <span className="queue-flag">{trace.report_count === 1 ? "Flagged" : `Flagged (${trace.report_count})`}</span>}
    {waited && <span className={`wait-chip ${waitTone(trace.submitted_at)}`}>{waited}</span>}
  </>;
}
