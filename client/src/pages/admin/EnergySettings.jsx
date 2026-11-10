import React, { useEffect, useRef, useState } from "react";
import useRemoteData from "../../hooks/useRemoteData.js";
import RemoteState from "../../components/RemoteState.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import Button from "../../components/Button.jsx";
import { shortDate } from "../../api/relativeTime.js";
import { useApp } from "../../context/AppContext.jsx";

export default function EnergySettings() {
  const result = useRemoteData("admin/energy-settings", { object: true });
  return <><RemoteState {...result} />{result.data && <EnergyPanel initial={result.data} reload={result.retry} />}</>;
}

function statusRows(saved) {
  const who = saved.updated_by_name || "An admin";
  if (saved.active) return [["Status", "On"], ["Awarding since", shortDate(saved.activated_at)], ["Turned on by", who]];
  if (saved.updated_at) return [["Status", "Paused"], ["Paused on", shortDate(saved.updated_at)], ["Paused by", who]];
  return [["Status", "Not turned on yet"]];
}

function EnergyPanel({ initial, reload }) {
  const { writeData } = useApp();
  const [saved, setSaved] = useState(initial);
  const [asking, setAsking] = useState(null);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);
  async function change(active) {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError(""); setNotice("");
    try {
      const next = await writeData("admin/energy-settings", { method: "PUT", body: { active }, signal: controller.signal });
      if (controller.signal.aborted) return;
      if (next?.active !== active) throw new Error("Could not verify the saved status.");
      setSaved(next); setAsking(null);
      setNotice(active ? "Tide Energy is on. Awards start now." : "Awards are paused.");
    } catch (failure) {
      if (controller.signal.aborted || failure.code === "CANCELLED") return;
      setAsking(null); setBlocked(true);
      setError(`${failure.message} Reload the status before trying again.`);
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return <section className="card admin-settings-panel" aria-labelledby="energy-settings-title">
    <header className="admin-settings-panel__header">
      <h3 id="energy-settings-title">Tide Energy</h3>
      <p>Members earn Tide Energy for approved Traces, finished Tides and passed quizzes. Every change here is recorded in the system logs.</p>
    </header>
    <dl className="admin-settings-rules">{statusRows(saved).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <div className="admin-settings-actions">
      {saved.active
        ? <Button variant="outline" size="sm" disabled={blocked} onClick={() => setAsking(false)}>Pause awards</Button>
        : <Button size="sm" disabled={blocked} onClick={() => setAsking(true)}>Activate Tide Energy</Button>}
      {blocked && <Button variant="outline" size="sm" onClick={reload}>Reload status</Button>}
    </div>
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert">{error}</p>}
    {asking !== null && <ConfirmDialog title={asking ? "Activate Tide Energy?" : "Pause awards?"} confirmLabel={asking ? "Activate" : "Pause awards"} busy={busy}
      onConfirm={() => change(asking)} onCancel={() => { if (!busy) setAsking(null); }}>
      {asking
        ? <p>Members start earning from this moment. Traces approved, Tides finished and quizzes passed before now do not count.</p>
        : <p>No new energy is awarded while paused. Balances stay as they are. Activating again starts awarding from that moment.</p>}
    </ConfirmDialog>}
  </section>;
}
