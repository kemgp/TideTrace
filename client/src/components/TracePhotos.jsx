import TracePhotoSelector from "./TracePhotoSelector.jsx";
import { compressPhoto } from "../api/compressPhoto.js";
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import SubmitTrace from "./SubmitTrace.jsx";
import { ApiError } from "../api/auth.js";
import { useApp } from "../context/AppContext.jsx";
import { useUnsavedChanges } from "./NavigationGuard.jsx";

import { PHOTO_TYPES as TYPES, photoError } from "../api/photos.js";

function PhotoViewer({ photos, index, onIndex, onClose }) {
  const dialog = useRef(null);
  const photo = photos[index];
  const count = photos.length;
  useLayoutEffect(() => {
    const element = dialog.current;
    element.showModal?.();
    return () => element.close?.();
  }, []);
  const step = (direction) => onIndex((index + direction + count) % count);
  // Escape asks to close; React unmounts the viewer. Do not listen for the native close event: in
  // development StrictMode closes and reopens the dialog once, and that event would dismiss it.
  return <dialog ref={dialog} className="photo-viewer" aria-label="Photo viewer"
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onKeyDown={(event) => {
      if (count < 2) return;
      if (event.key === "ArrowLeft") { event.preventDefault(); step(-1); }
      if (event.key === "ArrowRight") { event.preventDefault(); step(1); }
    }}
    onClick={(event) => { if (event.target === dialog.current) onClose(); }}>
    <button type="button" className="btn outline sm photo-viewer__close" autoFocus onClick={onClose}>Close</button>
    <img src={photo.url} alt={photo.alt} referrerPolicy="no-referrer" />
    {count > 1 && <>
      <button type="button" className="photo-viewer__nav photo-viewer__nav--prev" aria-label="Previous photo" onClick={() => step(-1)}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5 M12 19l-7-7 7-7" /></svg></button>
      <button type="button" className="photo-viewer__nav photo-viewer__nav--next" aria-label="Next photo" onClick={() => step(1)}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14 M12 5l7 7-7 7" /></svg></button>
      <p className="photo-viewer__count" role="status">{index + 1} of {count}</p>
    </>}
  </dialog>;
}

function SavedPhoto({ media, index, hero = false, active = true, alt, onUrl, onExpand }) {
  const { readData, profile } = useApp();
  const [requested, setRequested] = useState(false);
  const deferred = profile?.data_saver && !requested;
  const [attempt, setAttempt] = useState(0);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (deferred) return;
    const controller = new AbortController();
    setUrl("");
    setError("");
    readData(`media/${encodeURIComponent(media.id)}/url`, { signal: controller.signal }).then((data) => {
      if (!data?.url || !/^https?:\/\//.test(data.url)) throw new Error("No photo preview was returned.");
      if (!controller.signal.aborted) setUrl(data.url);
    }).catch((failure) => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [media.id, readData, attempt, deferred]);
  useEffect(() => { if (url) onUrl?.(media.id, url); }, [url, media.id, onUrl]);
  const label = alt || media.alt_text || `Trace photo ${index + 1}`;
  const video = media.mime_type === "video/mp4";
  if (deferred) return <button type="button" className="btn outline sm" onClick={() => setRequested(true)}>Load {video ? "video" : "photo"} {index + 1}</button>;
  return <>
    {error ? <div><p role="alert">Photo {index + 1}: {error}</p><button className="btn outline sm" onClick={() => setAttempt((value) => value + 1)}>Reload photo {index + 1}</button></div>
      : url ? video ? <video src={url} controls preload="none" onError={() => setError("Video could not load. Reload it to get a fresh link.")} aria-label={`Trace video ${index + 1}`} style={{ width: "100%", maxHeight: 320 }} /> : <>{hero && <span className="trace-detail__backdrop" aria-hidden="true" style={{ backgroundImage: `url(${JSON.stringify(url)})` }} />}{hero && active && <button type="button" className="trace-detail__expand" aria-label={`View photo ${index + 1} larger`} onClick={() => onExpand?.(media.id)}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6 M9 21H3v-6 M21 3l-7 7 M3 21l7-7" /></svg></button>}<img src={url} alt={label} referrerPolicy="no-referrer" onError={() => setError("Preview could not load. Reload it to get a fresh link.")} style={{ display: "block", width: "100%", maxHeight: hero ? 420 : 320, objectFit: "contain", borderRadius: 8, position: "relative" }} /></>
        : <p role="status" className={hero ? "photo-loading" : undefined}>Loading photo {index + 1}…</p>}
  </>;
}

export default function TracePhotos({ trace, contribution = false, hero = false, initialUpload = null, saveOnly = false, onChange, onLockedChange, onValidation, locked: externalLocked = false, operationLock: sharedLock }) {
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
  const [submissionPending, setSubmissionPending] = useState(false);
  const [validation, setValidation] = useState({});
  const reportValidation = useCallback((next) => { setValidation(next); onValidation?.(next); }, [onValidation]);
  const localLock = useRef(null);
  const operationLock = sharedLock || localLock;
  const locked = externalLocked || submissionLocked;
  const input = useRef(null);
  const request = useRef(null);
  const [active, setActive] = useState(0);
  const [urls, setUrls] = useState({});
  const [viewerId, setViewerId] = useState(null);
  const rememberUrl = useCallback((id, value) => setUrls((saved) => saved[id] === value ? saved : { ...saved, [id]: value }), []);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { onLockedChange?.(submissionLocked || Boolean(busy)); }, [submissionLocked, busy, onLockedChange]);
  const update = (saved) => { if (onChange) onChange(saved); else setLocalTrace(saved); };
  const editable = contribution && current.author_id === profile?.id && ["draft", "revision_requested"].includes(current.status) && !current.is_hidden && !current.deleted_at;
  useUnsavedChanges(editable && Boolean(file || attachment || busy || submissionPending), {
    onDiscard: () => { request.current?.abort(); operationLock.current?.abort(); },
    pendingRequest: Boolean(busy && busy !== "compress") || submissionPending,
  });
  const media = [...(current.trace_media || [])].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  const images = media.filter((item) => TYPES.includes(item.mime_type) && urls[item.id]).map((item) => ({ id: item.id, url: urls[item.id], alt: hero && current.title ? `${current.title}, photo ${media.indexOf(item) + 1}` : item.alt_text || `Trace photo ${media.indexOf(item) + 1}` }));
  const viewerIndex = images.findIndex((item) => item.id === viewerId);
  const select = async (files) => {
    if (busy || locked || operationLock.current || uncertain || attachment || !files?.length) return;
    const selected = files[0];
    setFile(null);
    setError("");
    setNotice("");
    if (input.current) input.current.value = "";
    const validation = files.length > 1 ? "Choose one photo at a time." : photoError(selected);
    if (validation) { setError(validation); return; }
    if (profile.data_saver) {
      setBusy("compress");
      try { setFile(await compressPhoto(selected)); }
      catch (failure) { setError(failure.message); }
      finally { setBusy(""); }
    } else setFile(selected);
  };
  const refresh = async (signal, minimumVersion = current.version) => {
    const saved = await readData(`${contribution ? "contributions" : "traces"}/${encodeURIComponent(trace.id)}`, { signal });
    if (saved?.id !== trace.id || saved.author_id !== profile.id || !Number.isInteger(saved.version) || saved.version < 1 || saved.version < minimumVersion || !Array.isArray(saved.trace_media)) throw new ApiError("Unable to reload saved attachments. Please try again.", "INVALID_RESPONSE");
    if (!signal.aborted) update(saved);
    return saved;
  };
  // Shared by explicit submission and save-only photo recovery, under one lock.
  const preparePhoto = async (signal, source) => {
    if (!file && !attachment) return;
    setBusy("upload");
    setError("");
    setNotice("");
    let uploaded = false;
    try {
      let saved = attachment && source.trace_media.find((item) => item.object_path === attachment);
      if (!saved) saved = attachment
        ? await writeData(`traces/${encodeURIComponent(trace.id)}/media/attach`, { method: "POST", body: { object_path: attachment }, signal })
        : await writeData(`traces/${encodeURIComponent(trace.id)}/media`, { method: "POST", file, signal });
      if (signal.aborted) return;
      if (!saved?.id || saved.trace_id !== trace.id || !TYPES.includes(saved.mime_type)) throw new ApiError("Upload response could not be verified.", "INVALID_RESPONSE");
      uploaded = true;
      // Attachment changes bump the Trace version. Reload instead of retaining stale fields/version.
      if (saved.object_path) setAttachment(saved.object_path);
      const latest = await refresh(signal, source.version);
      if (signal.aborted) return;
      if (!latest.trace_media.some((item) => item.id === saved.id)) throw new ApiError("Unable to verify the saved photo.", "INVALID_RESPONSE");
      setFile(null);
      setAttachment(null);
      if (input.current) input.current.value = "";
      return latest;
    } catch (failure) {
      if (signal.aborted || failure.code === "CANCELLED") throw failure;
      if (failure.code === "MEDIA_ATTACH_FAILED" && typeof failure.details?.object_path === "string") {
        setAttachment(failure.details.object_path);
        setError(`Your photo uploaded, but attaching it failed. ${saveOnly ? "Retry attachment" : "Submit for review again"} to retry with the existing upload.`);
      } else if (uploaded || failure.code === "NETWORK_ERROR" || failure.code === "INVALID_RESPONSE" || failure.status >= 500) {
        setUncertain(true);
        setError("We could not confirm the photo upload. Reload saved attachments and check them before trying again.");
      } else setError(failure.message);
      throw new ApiError("Resolve the photo upload before continuing.", "PHOTO_UPLOAD_FAILED");
    } finally {
      if (!signal.aborted) setBusy("");
    }
  };
  const run = async (action, id) => {
    if (request.current || locked || operationLock?.current || (action === "upload" && (uncertain || !editable || (!file && !attachment)))) return;
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
      } else if (action === "upload") {
        const latest = await refresh(controller.signal);
        if (controller.signal.aborted) return;
        if (latest.author_id !== profile.id || !["draft", "revision_requested"].includes(latest.status) || latest.is_hidden || latest.deleted_at) throw new Error("This Trace is no longer available for photo changes.");
        await preparePhoto(controller.signal, latest);
        if (controller.signal.aborted) return;
        setNotice("Photo saved and attached. Your details and photo are saved; this action did not submit the Trace for review.");
      } else if (action === "remove") {
        await writeData(`media/${encodeURIComponent(id)}`, { method: "DELETE", signal: controller.signal });
        wrote = true;
        if (controller.signal.aborted) return;
        await refresh(controller.signal);
        if (controller.signal.aborted) return;
        setNotice("Photo removed from this draft.");
      }
    } catch (failure) {
      if (controller.signal.aborted || failure.code === "CANCELLED") return;
      if (failure.code === "PHOTO_UPLOAD_FAILED") return;
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
    {media.length === 0 && <p className={hero ? "trace-detail__media-empty" : "hint"}>{hero && <span className="trace-detail__media-icon" aria-hidden="true">🌊</span>}No photos attached yet.</p>}
    <div className={hero ? "trace-detail__media-grid" : undefined} style={hero ? undefined : { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 16 }}>
      {media.map((item, index) => <div className={hero ? `trace-detail__media-item${index === Math.min(active, media.length - 1) ? " is-active" : ""}` : undefined} key={item.id}>
        {TYPES.includes(item.mime_type) || item.mime_type === "video/mp4" ? <SavedPhoto key={`${item.id}:${Boolean(profile?.data_saver)}`} media={item} index={index} hero={hero}
          active={index === Math.min(active, media.length - 1)} alt={hero && current.title ? `${current.title}, photo ${index + 1}` : undefined} onUrl={hero ? rememberUrl : undefined} onExpand={hero ? setViewerId : undefined} /> : <p className="hint">Unsupported attachment.</p>}
        {hero && index !== Math.min(active, media.length - 1) && <button type="button" className="trace-detail__thumb" aria-label={`Show photo ${index + 1}`} onClick={() => setActive(index)} />}
        {editable && <button className="btn outline sm" style={{ marginTop: 8 }} disabled={locked || Boolean(busy) || uncertain} onClick={() => run("remove", item.id)}>Remove {TYPES.includes(item.mime_type) ? "photo" : "attachment"} {index + 1}</button>}
      </div>)}
    </div>
    {hero && viewerIndex >= 0 && <PhotoViewer photos={images} index={viewerIndex} onIndex={(next) => { setViewerId(images[next].id); setActive(media.findIndex((item) => item.id === images[next].id)); }} onClose={() => setViewerId(null)} />}
    {editable && <TracePhotoSelector id="trace-photo" label="Choose a photo" inputRef={input} file={file} onSelect={select}
      disabled={locked || Boolean(busy) || uncertain || Boolean(attachment)} processing={busy === "compress"} uploading={busy === "upload"}
      invalid={Boolean(error || validation.photo)} describedBy={[error && "trace-photo-error", validation.photo && "trace-photo-validation"].filter(Boolean).join(" ")}
      removeLabel="Clear selected photo" onRemove={!uncertain && !attachment ? () => { setFile(null); if (input.current) input.current.value = ""; } : undefined}
      helper={<>JPEG, PNG or WebP, up to 20 MB. {saveOnly ? "Retry saving the photo to this existing draft. This does not submit it for review." : "Saved photos stay with the draft. On this detail page, Submit for review uploads a newly selected photo and sends the Trace for review."} Wait for confirmation before leaving.</>} />}
    {(busy === "remove" || busy === "reload") && <div role="status">{busy === "remove" ? "Removing attachment…" : "Reloading saved attachments…"}</div>}
    {!onValidation && validation.photo && <p id="trace-photo-validation" role="alert">{validation.photo}</p>}
    {error && <p id="trace-photo-error" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {!onChange && contribution && current.status === "pending" && <p role="status">Submitted for review. Open your saved Trace to check its status.</p>}
    {(uncertain || attachment) && <button className="btn outline sm" disabled={locked || Boolean(busy)} onClick={() => run("reload")}>Reload saved attachments</button>}
    {editable && saveOnly && (file || attachment) && <button className="btn outline" disabled={locked || Boolean(busy) || uncertain} onClick={() => run("upload")}>{busy === "upload" ? "Uploading photo…" : attachment ? "Retry attachment" : "Retry photo upload"}</button>}
    {editable && !saveOnly && <SubmitTrace trace={current} onChange={update} photosBlocked={Boolean(busy) || uncertain}
      hasSelectedPhoto={Boolean(file || attachment)} preparePhoto={preparePhoto} operationLock={operationLock}
      onLockedChange={setSubmissionLocked} onPendingChange={setSubmissionPending} onValidation={reportValidation} />}
    {!onValidation && Object.entries(validation).filter(([key]) => key !== "photo").map(([key, message]) => <p key={key} role="alert">{message}</p>)}
  </section>;
}
