import React, { useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext.jsx";
export default function DataSaverPreference() {
  const { profile } = useApp();
  return <Preference key={profile.id} />;
}
function Preference() {
  const { profile, writeData, retrySession } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);
  async function change(reload = false) {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(""); setNotice("");
    const enabled = !profile.data_saver;
    try {
      if (!reload) {
        const saved = await writeData("profile/data-saver", { method: "PATCH", body: { data_saver: enabled }, signal: controller.signal });
        if (controller.signal.aborted) return;
        if (saved?.id !== profile.id || saved.data_saver !== enabled) throw new Error("Could not confirm the saved preference.");
      }
      const account = await retrySession();
      if (controller.signal.aborted) return;
      if (account?.profile.id !== profile.id || typeof account.profile.data_saver !== "boolean" || (!reload && account.profile.data_saver !== enabled)) throw new Error("Could not verify the saved preference.");
      setNotice("Preference saved.");
    } catch (failure) {
      if (!controller.signal.aborted) setError(`${failure.message} Reload to check your saved preference.`);
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return <section aria-label="Data saver preference">
    <div className="setrow"><div><div className="l">Data saver</div><div className="s">Smaller Trace photo uploads. Load evidence photos and videos when you choose, on any connection.</div></div>
      <button type="button" role="switch" aria-label="Data saver" aria-checked={Boolean(profile.data_saver)} className={`tgl ${profile.data_saver ? "" : "off"}`} disabled={busy || Boolean(error)} onClick={() => change()} />
    </div>
    <span role="status" className="sr-only">{busy ? "Saving preference…" : notice}</span>
    {error && <div><p role="alert">{error}</p><button type="button" className="btn outline sm" disabled={busy} onClick={() => change(true)}>Reload data saver preference</button></div>}
  </section>;
}
