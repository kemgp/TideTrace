import React, { useRef, useState } from "react";
import { useApp } from "../context/AppContext.jsx";

export default function TraceLocationPrivacy({ trace, onChange, disabled = false }) {
  const { writeData } = useApp();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  if (trace.is_sensitive) return <p className="hint">Sensitive location: exact coordinates are visible only to the author and active staff.</p>;
  const hide = async () => {
    if (lock.current || uncertain || disabled) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const saved = await writeData(`traces/${trace.id}/hide-location`, { method: "POST", body: { version: trace.version } });
      if (saved?.id !== trace.id || saved.is_sensitive !== true || !Number.isInteger(saved.version) || saved.version <= trace.version) throw new Error("Unable to verify location privacy.");
      onChange({ ...trace, ...saved });
    } catch (failure) { setUncertain(true); setError(`${failure.message} Reload the Trace to check its saved state before trying again.`); }
    finally { lock.current = false; setBusy(false); }
  };
  return <div style={{ marginBlock: 12 }}>
    <button type="button" className="btn outline sm" disabled={disabled || busy || uncertain} onClick={hide}>{busy ? "Hiding location…" : "Hide exact location"}</button>
    <p className="hint">Hides the pin only. Text and photos may still reveal the location.</p>
    {error && <p role="alert">{error}</p>}
  </div>;
}
