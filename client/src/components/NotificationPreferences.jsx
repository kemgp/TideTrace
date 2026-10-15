import React, { useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext.jsx";

const preferences = [
  ["submission_updates", "Submission updates", "When your Trace is approved, rejected, or needs revision."],
  ["trace_comments", "Comments on my traces", "When someone comments on a Trace you posted."],
  ["new_tides", "New Tides", "When a new learning resource is published."],
];
function validate(value) {
  if (!value || !preferences.every(([key]) => typeof value[key] === "boolean")) throw new Error("Could not verify your saved notification preferences.");
  return value;
}
export default function NotificationPreferences() {
  const { profile } = useApp();
  return <Preferences key={profile.id} />;
}
function Preferences() {
  const { readData, writeData } = useApp();
  const [saved, setSaved] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const request = useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    setSaved(null); setError(""); setNotice("");
    readData("notification-preferences", { signal: controller.signal }).then(value => {
      if (!controller.signal.aborted) setSaved(validate(value));
    }).catch(failure => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [readData, attempt]);
  useEffect(() => () => request.current?.abort(), []);
  async function toggle(key) {
    if (!saved || request.current) return;
    const controller = new AbortController();
    request.current = controller; setBusy(true); setNotice(""); setError("");
    try {
      const value = validate(await writeData("notification-preferences", {
        method: "PATCH", body: { key, enabled: !saved[key] }, signal: controller.signal,
      }));
      if (!controller.signal.aborted) {
        if (value[key] !== !saved[key]) throw new Error("Could not confirm the saved preference.");
        setSaved(value); setNotice("Preference saved.");
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        setSaved(null);
        setError(`${failure.message} Reload preferences to check the saved settings.`);
      }
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return <section aria-label="Notification preferences">
    <h3>Notifications</h3>
    <p className="hint">Choose your in-app alerts. Saved across your devices. Existing notifications stay in your inbox.</p>
    {!saved && !error && <p role="status">Loading notification preferences…</p>}
    {preferences.map(([key, label, description]) => <div className="setrow" key={key}>
      <div><div className="l">{label}</div><div className="s">{description}</div></div>
      <button type="button" className={`tgl ${saved?.[key] ? "" : "off"}`} role="switch" aria-label={label}
        aria-checked={saved?.[key] ?? false} disabled={!saved || busy} onClick={() => toggle(key)} />
    </div>)}
    <p className="hint">Submission status and feedback remain in My contributions. Account, moderation, and report notices remain enabled.</p>
    <span className="sr-only" role="status" aria-atomic="true">{busy ? "Saving preference…" : notice}</span>
    {error && <div><p role="alert">{error}</p><button type="button" className="btn outline sm" onClick={() => setAttempt(n => n + 1)}>Reload preferences</button></div>}
  </section>;
}
