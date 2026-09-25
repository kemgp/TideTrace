import React, { useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import useRemoteData from "../hooks/useRemoteData.js";
import RemoteState from "./RemoteState.jsx";
import { traceValidation, hasAttachedPhoto } from "../api/traceValidation.js";
import { ApiError } from "../api/auth.js";

const editable = (trace, owner) => trace.author_id === owner && ["draft", "revision_requested"].includes(trace.status) && !trace.is_hidden && !trace.deleted_at;


export default function SubmitTrace({ trace, onChange, photosBlocked, hasSelectedPhoto = false, preparePhoto, operationLock, onLockedChange, onValidation }) {
  const { readData, writeData, profile } = useApp();
  const categories = useRemoteData("categories", { collection: true });
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { onLockedChange(busy || blocked); }, [busy, blocked, onLockedChange]);
  const revision = trace.status === "revision_requested";
  const ready = !categories.loading && !categories.error;
  useEffect(() => {
    if (attempted && ready) onValidation(traceValidation(trace, categories.data || [], { hasPhoto: hasSelectedPhoto || hasAttachedPhoto(trace) }));
  }, [attempted, ready, trace, categories.data, onValidation, hasSelectedPhoto]);
  const run = async (reload = false) => {
    if (request.current || operationLock.current || (!reload && (blocked || photosBlocked || !ready))) return;
    if (!reload) {
      setAttempted(true);
      const validation = traceValidation(trace, categories.data || [], { hasPhoto: hasSelectedPhoto || hasAttachedPhoto(trace) });
      onValidation(validation);
      if (Object.keys(validation).length) return;
    }
    const controller = new AbortController();
    request.current = controller;
    operationLock.current = controller;
    setBusy(true);
    setError("");
    let writing = false;
    try {
      let latest = await readData(`contributions/${encodeURIComponent(trace.id)}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (latest?.id !== trace.id || latest.author_id !== profile.id || !Number.isInteger(latest.version) || latest.version < 1 || !Array.isArray(latest.trace_media)) throw new ApiError("Unable to verify the saved Trace. Reload it before submitting.", "INVALID_RESPONSE");
      if (reload || !editable(latest, profile.id)) {
        onChange(latest);
        setBlocked(false);
        if (!reload && latest.status !== "pending") setError("This Trace is no longer available for submission.");
        return;
      }
      const activeCategories = await readData("categories", { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!Array.isArray(activeCategories)) throw new ApiError("Unable to verify the category. Try again.", "INVALID_RESPONSE");
      const missing = traceValidation(latest, activeCategories, { hasPhoto: hasSelectedPhoto || hasAttachedPhoto(latest) });
      if (Object.keys(missing).length) {
        onChange(latest);
        categories.retry();
        onValidation(missing);
        return;
      }
      // Do not silently submit another tab's text edits that the member has not seen.
      if (latest.status !== trace.status || ["title", "description", "location_name", "category_id", "latitude", "longitude"].some((field) => latest[field] !== trace[field])) {
        onChange(latest);
        setError("The saved details changed. Review the updated Trace, then submit again.");
        return;
      }
      if (hasSelectedPhoto) {
        await preparePhoto(controller.signal, latest);
        if (controller.signal.aborted) return;
        const refreshed = await readData(`contributions/${encodeURIComponent(trace.id)}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (refreshed?.id !== trace.id || refreshed.author_id !== profile.id || !Number.isInteger(refreshed.version) || refreshed.version < latest.version || !Array.isArray(refreshed.trace_media)) throw new ApiError("Unable to verify the Trace after uploading. Reload it before submitting.", "INVALID_RESPONSE");
        onChange(refreshed);
        if (!editable(refreshed, profile.id) || refreshed.status !== latest.status || ["title", "description", "location_name", "category_id", "latitude", "longitude"].some((field) => refreshed[field] !== latest[field])) {
          setError("The saved details changed during upload. Review the updated Trace before submitting again.");
          return;
        }
        latest = refreshed;
        const afterUpload = traceValidation(latest, activeCategories, { hasPhoto: hasAttachedPhoto(latest) });
        onValidation(afterUpload);
        if (Object.keys(afterUpload).length) return;
      }
      writing = true;
      const saved = await writeData(`traces/${encodeURIComponent(trace.id)}/submit`, { method: "POST", body: { version: latest.version }, signal: controller.signal });
      if (controller.signal.aborted) return;
      if (saved?.id !== trace.id || saved.status !== "pending" || !Number.isInteger(saved.version) || saved.version <= latest.version) throw new ApiError("Submission response could not be verified.", "INVALID_RESPONSE");
      onChange({ ...latest, ...saved });
    } catch (failure) {
      if (controller.signal.aborted || failure.code === "CANCELLED") return;
      if (failure.code === "PHOTO_UPLOAD_FAILED") return;
      if (failure.status === 409) {
        setBlocked(true);
        setError("This Trace changed before submission. Reload the saved Trace and review it before trying again.");
      } else if (writing && (failure.code === "NETWORK_ERROR" || failure.code === "INVALID_RESPONSE" || failure.status >= 500)) {
        setBlocked(true);
        setError("We could not confirm submission. Reload the saved Trace to check its status before trying again.");
      } else setError(failure.message);
    } finally {
      if (operationLock.current === controller) operationLock.current = null;
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  return <section aria-label="Submit Trace for review" style={{ marginTop: 24 }}>
    <h3>{revision ? "Resubmit for review" : "Submit for review"}</h3>
    <p className="hint">Submission uploads your selected photo and sends this saved Trace to the review queue. It stays out of the community archive until approved, and you cannot edit it while it is pending.</p>
    <RemoteState {...categories} />
    {photosBlocked && <p className="hint">Resolve any photo upload errors before submitting.</p>}
    {error && <p role="alert">{error}</p>}
    <button className="btn clay" disabled={busy || blocked || photosBlocked || !ready} onClick={() => run()}>{busy ? "Checking submission…" : revision ? "Resubmit for review" : "Submit for review"}</button>
    {blocked && <button className="btn outline" style={{ marginLeft: 8 }} disabled={busy} onClick={() => run(true)}>Reload saved Trace</button>}
  </section>;
}
