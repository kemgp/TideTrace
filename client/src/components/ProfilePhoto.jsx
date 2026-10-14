import React, { useEffect, useId, useRef, useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { ApiError } from "../api/auth.js";
import { PHOTO_TYPES } from "../api/photos.js";
import { avatarCrop, exportAvatar } from "../api/avatarCrop.js";
import AvatarImage from "./AvatarImage.jsx";

export function ProfileAvatar() {
  const { profile } = useApp();
  return <AvatarImage name={profile?.display_name} url={profile?.avatar_url} />;
}

export default function ProfilePhoto() {
  const { profile } = useApp();
  return <PhotoPicker key={profile.id} />;
}

function PhotoPicker() {
  const { profile, writeData, readData, retrySession } = useApp();
  const input = useRef(null);
  const request = useRef(null);
  const image = useRef(null);
  const drag = useRef(null);
  const zoomId = useId();
  const [selection, setSelection] = useState(null);
  const [dimensions, setDimensions] = useState(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => () => { if (selection) URL.revokeObjectURL(selection.url); }, [selection]);
  const crop = dimensions ? avatarCrop(dimensions.width, dimensions.height, zoom, position.x, position.y) : null;
  const clamp = (value) => Math.max(-1, Math.min(1, value));

  function choose(file) {
    if (!file || busy || blocked) return;
    setError(""); setNotice("");
    if (!PHOTO_TYPES.includes(file.type) || !file.size || file.size > 5 * 1024 * 1024) {
      setError("Choose a non-empty JPEG, PNG or WebP photo no larger than 5 MB.");
      return;
    }
    setDimensions(null); setPosition({ x: 0, y: 0 }); setZoom(1);
    setSelection({ url: URL.createObjectURL(file) });
  }

  async function save(reload = false) {
    if (request.current || (!reload && (!crop || blocked))) return;
    setError(""); setNotice("");
    const controller = new AbortController();
    request.current = controller; setBusy(true);
    try {
      const file = reload ? null : await exportAvatar(image.current, crop);
      if (controller.signal.aborted) return;
      const saved = reload
        ? await readData("auth/me", { signal: controller.signal })
        : await writeData("profile/photo", { method: "POST", file, signal: controller.signal });
      if (controller.signal.aborted) return;
      if (saved?.id !== profile.id || (!reload && typeof saved.avatar_path !== "string")) throw new ApiError("The saved photo could not be verified.", "INVALID_RESPONSE");
      const refreshed = await retrySession();
      if (controller.signal.aborted) return;
      if (refreshed?.profile.id !== profile.id || refreshed.profile.avatar_path !== saved.avatar_path || (saved.avatar_path && !refreshed.profile.avatar_url)) {
        throw new ApiError("The photo was saved, but could not be loaded. Reload the saved profile to try again.", "INVALID_RESPONSE");
      }
      setBlocked(false);
      setSelection(null); setDimensions(null);
      setNotice(reload ? "Saved profile reloaded." : "Profile photo saved.");
    } catch (failure) {
      if (controller.signal.aborted || failure.code === "CANCELLED") return;
      if (!reload && (failure.code === "NETWORK_ERROR" || failure.code === "INVALID_RESPONSE" || failure.status >= 500)) {
        setBlocked(true);
        setError("We could not confirm the photo change. Reload the saved profile before trying again.");
      } else setError(failure.message);
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return <div className="profile-photo-editor">
    {selection ? <div className="profile-photo-crop-controls">
      <div className="profile-photo-crop" tabIndex={busy || blocked ? -1 : 0} role="group" aria-label="Circular photo preview" aria-describedby={`${zoomId}-help`}
        onKeyDown={(event) => {
          if (!crop || busy || blocked || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
          event.preventDefault();
          setPosition((current) => ({ x: clamp(current.x + (event.key === "ArrowLeft" ? .05 : event.key === "ArrowRight" ? -.05 : 0)), y: clamp(current.y + (event.key === "ArrowUp" ? .05 : event.key === "ArrowDown" ? -.05 : 0)) }));
        }}
        onPointerDown={(event) => {
          if (!crop || busy || blocked || event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, position, size: event.currentTarget.getBoundingClientRect().width };
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start || start.id !== event.pointerId || !crop || busy || blocked) return;
          setPosition({
            x: clamp(start.position.x - (dimensions.width > crop.size ? (event.clientX - start.x) * crop.size / start.size * 2 / (dimensions.width - crop.size) : 0)),
            y: clamp(start.position.y - (dimensions.height > crop.size ? (event.clientY - start.y) * crop.size / start.size * 2 / (dimensions.height - crop.size) : 0)),
          });
        }}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
        <img key={selection.url} ref={image} src={selection.url} alt="Selected photo preview" draggable="false"
          style={crop ? { width: `${dimensions.width / crop.size * 100}%`, height: `${dimensions.height / crop.size * 100}%`, left: `${-crop.x / crop.size * 100}%`, top: `${-crop.y / crop.size * 100}%` } : { visibility: "hidden" }}
          onLoad={(event) => { if (event.currentTarget.naturalWidth && event.currentTarget.naturalHeight) setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight }); }}
          onError={() => { setSelection(null); setDimensions(null); setError("This photo could not be opened. Choose another JPEG, PNG or WebP image."); }} />
      </div>
      <p className="hint" id={`${zoomId}-help`}>Drag to reposition, or focus the preview and use arrow keys.</p>
      <label htmlFor={zoomId}>Zoom</label>
      <input id={zoomId} type="range" min="1" max="3" step="0.01" value={zoom} disabled={busy || blocked || !crop} onChange={(event) => setZoom(Number(event.target.value))} />
    </div> : <div className="profile-photo-preview"><ProfileAvatar /></div>}
    <input ref={input} type="file" hidden accept={PHOTO_TYPES.join(",")} aria-label="Choose profile photo" disabled={busy || blocked} onChange={(event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      choose(file);
    }} />
    <div className="profile-photo-actions">
      <button className="btn outline" type="button" disabled={busy || blocked} onClick={() => input.current?.click()}>Choose photo</button>
      {selection && <>
        <button className="btn blue" type="button" disabled={busy || blocked || !crop} onClick={() => save()}>{busy ? "Saving photo…" : "Save photo"}</button>
        <button className="btn ghost" type="button" disabled={busy || blocked} onClick={() => { setSelection(null); setDimensions(null); setError(""); }}>Cancel</button>
      </>}
    </div>
    <p className="hint">JPEG, PNG or WebP · Up to 5 MB. Your saved photo appears everywhere.</p>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {blocked && <button className="btn outline" type="button" disabled={busy} onClick={() => save(true)}>Reload saved profile</button>}
  </div>;
}
