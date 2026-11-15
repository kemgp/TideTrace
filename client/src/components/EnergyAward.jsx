import React, { useId, useRef, useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import useRemoteData from "../hooks/useRemoteData.js";
import { energyEnabled } from "../api/energy.js";
import { ConfirmDialog } from "../pages/moderator/modTools.jsx";
import "./energy.css";

// Staff view of Trace awards: did a reviewed Trace earn energy, and what happened to the flags this person raised.
// One read covers a whole page of Traces. Everything is hidden while VITE_ENERGY_ENABLED is off.
export function useAwards(traceIds) {
  const ids = [...new Set((traceIds || []).filter(Boolean))].slice(0, 100);
  const path = energyEnabled() && ids.length ? `moderation/energy/awards?trace_ids=${ids.map(encodeURIComponent).join(",")}` : null;
  const result = useRemoteData(path, { object: true, keepPrevious: true });
  const byTrace = new Map((result.data?.awards || []).map((award) => [award.trace_id, award]));
  return { ...result, enabled: Boolean(path), active: Boolean(result.data?.active), byTrace };
}

const flagMessage = (failure) => {
  if (failure.status === 409) return "This award already has an open flag.";
  if (failure.status === 403) return "You cannot flag this award.";
  if (failure.status === 400) return "This award cannot be flagged. It may already have been reversed.";
  return failure.message || "The flag could not be sent. Try again.";
};

// The line under a reviewed Trace: award status, the state of the caller's latest flag, and the "Flag award" action.
export default function EnergyAward({ traceId, title, awards, canFlag = true }) {
  const { writeData } = useApp();
  const reasonId = useId();
  const request = useRef(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  if (!awards.enabled) return null;
  if (awards.error && !awards.data) return <p className="award-line hint">Award status could not be loaded. <button type="button" className="btn ghost sm" onClick={awards.retry}>Try again</button></p>;
  if (!awards.data) return <p className="award-line hint" role="status">Checking award status…</p>;

  const award = awards.byTrace.get(traceId);
  if (!award) return <p className="award-line hint">{awards.active ? "No award: before activation" : "No award yet"}</p>;

  const latest = award.my_flags?.[0];
  const flagOpen = award.open_flag;
  // Right after sending, wait for the fresh status instead of briefly offering a second flag.
  const showFlagButton = canFlag && !award.reversed && !flagOpen && !(sent && awards.refreshing);
  const close = () => { if (busy) return; request.current?.abort(); setOpen(false); setReason(""); setError(""); };
  const send = async () => {
    if (request.current || !reason.trim()) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    try {
      await writeData(`moderation/energy/awards/${encodeURIComponent(award.ledger_id)}/flags`, { method: "POST", body: { reason: reason.trim() }, signal: controller.signal });
      setSent(true);
      setOpen(false);
      setReason("");
      awards.retry();
    } catch (failure) {
      if (failure.name === "AbortError") return;
      setError(flagMessage(failure));
      if (failure.status === 409 || failure.status === 400) awards.retry();
    } finally {
      request.current = null;
      setBusy(false);
    }
  };

  return <div className="award-line">
    <p><strong>{award.reversed ? `Award reversed: ${award.amount} Tide Energy` : `Award issued: ${award.amount} Tide Energy`}</strong></p>
    {flagOpen && <p className="award-flag-state">Flag open</p>}
    {!flagOpen && latest?.status === "dismissed" && <p className="award-flag-state">Flag dismissed.{latest.resolution_reason ? ` Admin's reason: ${latest.resolution_reason}` : ""}</p>}
    {!flagOpen && latest?.status === "upheld" && <p className="award-flag-state">Flag resolved: the award was reversed.{latest.resolution_reason ? ` Admin's reason: ${latest.resolution_reason}` : ""}</p>}
    {sent && flagOpen && <p className="award-flag-state" role="status">Flag sent. An admin will review it.</p>}
    {showFlagButton && <button type="button" className="btn outline sm" aria-label={`Flag award on ${title || "this Trace"}`} onClick={() => { setSent(false); setOpen(true); }}>Flag award</button>}
    {open && <ConfirmDialog title="Flag this award?" confirmLabel="Send flag" confirmClass="blue" busy={busy} disabled={!reason.trim()} onCancel={close} onConfirm={send}>
      <p>An admin will look at this award. You will be told what they decide.</p>
      <label className="lbl" htmlFor={reasonId}>Why should an admin look?</label>
      <textarea id={reasonId} className="input" rows={3} maxLength={2000} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} />
      {error && <p role="alert">{error}</p>}
    </ConfirmDialog>}
  </div>;
}
