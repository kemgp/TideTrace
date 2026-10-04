import React, { useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import useRemoteData from "../hooks/useRemoteData.js";
import RemoteState from "./RemoteState.jsx";

export default function TideCompletion({ tideId }) {
  const { profile } = useApp();
  return <Completion key={`${profile.id}:${tideId}`} tideId={tideId} />;
}

function Completion({ tideId }) {
  const { profile, writeData } = useApp();
  const result = useRemoteData(`tide-completions?tide_ids=${encodeURIComponent(tideId)}`, { collection: true });
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(null);
  useEffect(() => () => pending.current?.abort(), []);
  const completed = saved || result.data?.some((record) => record.tide_id === tideId);
  async function complete() {
    if (pending.current || completed) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true); setError("");
    try {
      const record = await writeData(`tides/${encodeURIComponent(tideId)}/completion`, { method: "PUT", signal: controller.signal });
      if (controller.signal.aborted) return;
      if (record?.user_id !== profile.id || record?.tide_id !== tideId || !record.completed_at) throw new Error("The saved completion could not be verified.");
      setSaved(true);
    } catch (failure) {
      if (controller.signal.aborted || failure.code === "CANCELLED") return;
      setError(`${failure.message} Check the saved status below before trying again.`);
      result.retry();
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return <section aria-label="Lesson completion" style={{ marginTop: 24 }}>
    <RemoteState compact {...result} />
    {error && !completed && <p role="alert">{error}</p>}
    {completed ? <p role="status">Completed</p> : <button className="btn blue" disabled={busy || result.loading || Boolean(result.error)} onClick={complete}>{busy ? "Saving…" : "Mark as complete"}</button>}
  </section>;
}
