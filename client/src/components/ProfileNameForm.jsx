import React, { useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { ApiError } from "../api/auth.js";

export default function ProfileNameForm() {
  const { profile } = useApp();
  return <NameForm key={profile.id} />;
}

function NameForm() {
  const { profile, writeData, readData, retrySession } = useApp();
  const [name, setName] = useState(profile.display_name);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);
  const run = async (reload = false) => {
    if (request.current || (!reload && blocked)) return;
    const displayName = name.trim();
    setError(""); setNotice("");
    if (!reload && (!displayName || displayName.length > 100)) { setError("Enter a name between 1 and 100 characters."); return; }
    const controller = new AbortController();
    request.current = controller; setBusy(true);
    try {
      const saved = reload
        ? await readData("auth/me", { signal: controller.signal })
        : await writeData("profile", { method: "PATCH", body: { display_name: displayName }, signal: controller.signal });
      if (controller.signal.aborted) return;
      if (saved?.id !== profile.id || typeof saved.display_name !== "string" || (!reload && saved.display_name !== displayName)) throw new ApiError("The saved profile could not be verified.", "INVALID_RESPONSE");
      setName(saved.display_name); setBlocked(false);
      setNotice(reload ? "Saved profile reloaded." : "Display name saved.");
      // Refresh the authenticated profile so navigation and account summaries agree.
      await retrySession();
    } catch (failure) {
      if (controller.signal.aborted || failure.code === "CANCELLED") return;
      if (!reload && (failure.code === "NETWORK_ERROR" || failure.code === "INVALID_RESPONSE" || failure.status >= 500)) {
        setBlocked(true);
        setError("We could not confirm the save. Reload the saved profile before trying again.");
      } else setError(failure.message);
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  return <form noValidate aria-label="Basic information" onSubmit={(event) => { event.preventDefault(); run(); }}>
    <div className="settings-section-title"><h2>Basic information</h2><p>Update your saved display name.</p></div>
    <fieldset disabled={busy || blocked} style={{ border: 0, padding: 0, minWidth: 0 }}>
      <div className="settings-form-grid">
        <div className="settings-field full"><label className="lbl" htmlFor="profile-display-name">Full name</label><input className="input" id="profile-display-name" value={name} maxLength={100} autoComplete="name" onChange={(event) => { setName(event.target.value); setError(""); setNotice(""); }} /></div>
        <div className="settings-field"><label className="lbl" htmlFor="profile-email">Email address</label><input className="input" id="profile-email" type="email" value={profile.email || ""} readOnly /></div>
      </div>
      <p className="hint">Email changes, profile photos and community details are not available yet.</p>
      <button className="btn blue settings-save" type="submit">{busy ? "Saving…" : "Save changes"}</button>
    </fieldset>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {blocked && <button type="button" className="btn outline" disabled={busy} onClick={() => run(true)}>Reload saved profile</button>}
  </form>;
}
