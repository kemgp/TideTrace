import React, { useEffect, useRef, useState } from "react";
import SubmitTrace from "./SubmitTrace.jsx";
import { ApiError } from "../api/auth.js";
import { useApp } from "../context/AppContext.jsx";

import { PHOTO_TYPES as TYPES, photoError } from "../api/photos.js";

function SavedPhoto({ media, index }) {
  const { readData } = useApp();
  const [attempt, setAttempt] = useState(0);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setUrl("");
    setError("");
    readData(`media/${encodeURIComponent(media.id)}/url`, { signal: controller.signal }).then((data) => {
      if (!data?.url || !/^https?:\/\//.test(data.url)) throw new Error("No photo preview was returned.");
      if (!controller.signal.aborted) setUrl(data.url);
    }).catch((failure) => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [media.id, readData, attempt]);
  return <>
    {error ? <div><p role="alert">Photo {index + 1}: {error}</p><button className="btn outline sm" onClick={() => setAttempt((value) => value + 1)}>Reload photo {index + 1}</button></div>
      : url ? <img src={url} alt={media.alt_text || `Trace photo ${index + 1}`} referrerPolicy="no-referrer" onError={() => setError("Preview could not load. Reload it to get a fresh link.")} style={{ display: "block", width: "100%", maxHeight: 320, objectFit: "contain", borderRadius: 8 }} />
        : <p role="status">Loading photo {index + 1}…</p>}
  </>;
}

export default function TracePhotos({ trace, contribution = false, hero = false, initialUpload = null, onChange, onLockedChange, onValidation, locked: externalLocked = false, operationLock: sharedLock }) {
  const { readData, writeData, profile } = useApp();
  const [localTrace, setLocalTrace] = useState(trace);
  const current = onChange ? trace : localTrace;
  const [file, setFile] = useState(initialUpload?.file || null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState(initialUpload?.error || "");
  const [notice, setNotice] = useState("");
  const [uncertain, setUncertain] = useState(initialUpload?.uncertain || false);
  const [attachment, setAttachment] = useState(initialUpload?.attachment || null);
  const [submissionLocked, setSubmissionLocked] = useState(false);
  const [validation, setValidation] = useState({});
  const localLock = useRef(null);
  const operationLock = sharedLock || localLock;
  const locked = externalLocked || submissionLocked;
  const input = useRef(null);
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { onLockedChange?.(submissionLocked || Boolean(busy)); }, [submissionLocked, busy, onLockedChange]);
  const update = (saved) => { if (onChange) onChange(saved); else setLocalTrace(saved); };
  const editable = contribution && current.author_id === profile?.id && ["draft", "revision_requested"].includes(current.status) && !current.is_hidden && !current.deleted_at;
  const media = [...(current.trace_media || [])].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  const select = (event) => {
    const selected = event.target.files?.[0];
    setFile(null);
    setError("");
    setNotice("");
    if (!selected) return;
    const validation = photoError(selected);
    if (validation) { setError(validation); event.target.value = ""; return; }
    setFile(selected);
  };
  const refresh = async (signal) => {
    const saved = await readData(`${contribution ? "contributions" : "traces"}/${encodeURIComponent(trace.id)}`, { signal });
    if (saved?.id !== trace.id || !Array.isArray(saved.trace_media)) throw new Error("Unable to reload saved attachments. Please try again.");
    if (!signal.aborted) update(saved);
    return saved;
  };
  // Called only by the explicit submit action, using its abort signal and shared lock.
  const preparePhoto = async (signal, source) => {
    if (!file && !attachment) return;
    setBusy("upload");
    setError("");
    setNotice("");
    try {
      let saved = attachment && source.trace_media.find((item) => item.object_path === attachment);
      if (!saved) saved = attachment
        ? await writeData(`traces/${encodeURIComponent(trace.id)}/media/attach`, { method: "POST", body: { object_path: attachment }, signal })
        : await writeData(`traces/${encodeURIComponent(trace.id)}/media`, { method: "POST", file, signal });
      if (signal.aborted) return;
      if (!saved?.id || saved.trace_id !== trace.id || !TYPES.includes(saved.mime_type)) throw new ApiError("Upload response could not be verified.", "INVALID_RESPONSE");
      update({ ...source, trace_media: [...source.trace_media.filter((item) => item.id !== saved.id), saved] });
      setFile(null);
      setAttachment(null);
      if (input.current) input.current.value = "";
    } catch (failure) {
      if (signal.aborted || failure.code === "CANCELLED") throw failure;
      if (failure.code === "MEDIA_ATTACH_FAILED" && typeof failure.details?.object_path === "string") {
        setAttachment(failure.details.object_path);
        setError("Your photo uploaded, but attaching it failed. Submit for review again to retry with the existing upload.");
      } else if (failure.code === "NETWORK_ERROR" || failure.code === "INVALID_RESPONSE" || failure.status >= 500) {
        setUncertain(true);
        setError("We could not confirm the photo upload. Reload saved attachments and check them before trying again.");
      } else setError(failure.message);
      throw new ApiError("Resolve the photo upload before submitting.", "PHOTO_UPLOAD_FAILED");
    } finally {
      if (!signal.aborted) setBusy("");
    }
  };
  const run = async (action, id) => {
    if (request.current || locked || operationLock?.current) return;
    const controller = new AbortController();
    request.current = controller;
    if (operationLock) operationLock.current = controller;
    setBusy(action);
    setError("");
    setNotice("");
    let wrote = false;
    try {
      if (action === "reload") {
        const saved = await refresh(controller.signal);
        if (controller.signal.aborted) return;
        if (attachment && saved.trace_media.some((item) => item.object_path === attachment)) setAttachment(null);
        setFile(null);
        if (input.current) input.current.value = "";
        setUncertain(false);
        setNotice("Saved attachments reloaded. Check the photos before uploading again.");
      } else if (action === "remove") {
        await writeData(`media/${encodeURIComponent(id)}`, { method: "DELETE", signal: controller.signal });
        wrote = true;
        if (controller.signal.aborted) return;
        update({ ...current, trace_media: (current.trace_media || []).filter((item) => item.id !== id) });
        setNotice("Photo removed from this draft.");
      }
    } catch (failure) {
      if (controller.signal.aborted || failure.code === "CANCELLED") return;
      if (action !== "reload" && (wrote || failure.code === "NETWORK_ERROR" || failure.code === "INVALID_RESPONSE" || failure.status >= 500)) {
        setUncertain(true);
        setError("We could not confirm the change. Reload saved attachments and check them before trying again.");
      } else setError(failure.message);
    } finally {
      if (!controller.signal.aborted) setBusy("");
      request.current = null;
      if (operationLock?.current === controller) operationLock.current = null;
    }
  };
  return <section aria-label="Trace photos" className={hero ? "trace-detail__media" : undefined} style={hero ? undefined : { marginTop: 24 }}>
    {!hero && <h3>Photos</h3>}
    {media.length === 0 && <p className={hero ? "trace-detail__media-empty" : "hint"}>No photos attached yet.</p>}
    <div className={hero ? "trace-detail__media-grid" : undefined} style={hero ? undefined : { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
      {media.map((item, index) => <div className={hero ? "trace-detail__media-item" : undefined} key={item.id}>
        {TYPES.includes(item.mime_type) ? <SavedPhoto media={item} index={index} /> : <p className="hint">Video attachment (playback is not available yet).</p>}
        {editable && <button className="btn outline sm" style={{ marginTop: 8 }} disabled={locked || Boolean(busy) || uncertain} onClick={() => run("remove", item.id)}>Remove {TYPES.includes(item.mime_type) ? "photo" : "attachment"} {index + 1}</button>}
      </div>)}
    </div>
    {editable && <div style={{ marginTop: 16 }}>
      <label className="lbl" htmlFor="trace-photo">Choose a photo</label>
      <input ref={input} id="trace-photo" type="file" accept={TYPES.join(",")} disabled={locked || Boolean(busy) || uncertain || Boolean(attachment)} onChange={select} />
      <p className="hint">JPEG, PNG or WebP, up to 20 MB. Your selected photo uploads when you submit for review. The selection is not saved if you leave or reload this page.</p>
      {file && <p>{file.name}</p>}
      {file && !uncertain && !attachment && <button className="btn outline sm" disabled={locked || Boolean(busy)} onClick={() => { setFile(null); if (input.current) input.current.value = ""; }}>Clear selected photo</button>}

    </div>}
    {busy && <div role="status"><progress aria-label="Photo operation in progress" /> {busy === "upload" ? "Uploading and attaching photo…" : busy === "remove" ? "Removing attachment…" : busy === "attach" ? "Attaching uploaded photo…" : "Reloading saved attachments…"}</div>}
    {!onValidation && validation.photo && <p role="alert">{validation.photo}</p>}
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {!onChange && contribution && current.status === "pending" && <p role="status">Submitted for review. Open your saved Trace to check its status.</p>}
    {(uncertain || attachment) && <button className="btn outline sm" disabled={locked || Boolean(busy)} onClick={() => run("reload")}>Reload saved attachments</button>}
    {editable && <SubmitTrace trace={current} onChange={update} photosBlocked={Boolean(busy) || uncertain}
      hasSelectedPhoto={Boolean(file || attachment)} preparePhoto={preparePhoto} operationLock={operationLock}
      onLockedChange={setSubmissionLocked} onValidation={onValidation || setValidation} />}
    {!onValidation && Object.entries(validation).filter(([key]) => key !== "photo").map(([key, message]) => <p key={key} role="alert">{message}</p>)}
  </section>;
}
