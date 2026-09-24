import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import useRemoteData from "../hooks/useRemoteData.js";
import { ApiError } from "../api/auth.js";
import RemoteState from "./RemoteState.jsx";
import Card from "./Card.jsx";
import TracePhotos from "./TracePhotos.jsx";
import { PHOTO_TYPES, photoError } from "../api/photos.js";

function SelectedPhoto({ file }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const preview = URL.createObjectURL(file);
    setUrl(preview);
    return () => URL.revokeObjectURL(preview);
  }, [file]);
  return url ? <img src={url} alt="Selected photo preview" style={{ display: "block", maxWidth: "100%", maxHeight: 240, marginTop: 12, borderRadius: 8 }} /> : null;
}

export default function TraceDraftForm({ trace = null, onReload }) {
  const { writeData, showToast } = useApp();
  const navigate = useNavigate();
  const categories = useRemoteData("categories", { collection: true });
  const [fields, setFields] = useState(() => ({ title: trace?.title || "", category_id: trace?.category_id || "", location_name: trace?.location_name || "", description: trace?.description || "" }));
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [photoValidation, setPhotoValidation] = useState("");
  const [uploading, setUploading] = useState(false);
  const [savedDraft, setSavedDraft] = useState(null);
  const [initialUpload, setInitialUpload] = useState(null);
  const photoInput = useRef(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);
  const request = useRef(null);
  useEffect(() => () => { request.current?.abort(); }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const available = categories.data || [];
  const validCategory = available.some((category) => category.id === fields.category_id);
  const change = (event) => {
    setFields((previous) => ({ ...previous, [event.target.name]: event.target.value }));
    setDirty(true);
  };
  const save = async (event) => {
    event.preventDefault();
    if (request.current || blocked || savedDraft) return;
    if (!validCategory) { setError("Choose an available category before saving."); return; }
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    try {
      const sameLocation = trace && fields.location_name.trim() === trace.location_name;
      const saved = await writeData(trace ? `traces/${encodeURIComponent(trace.id)}` : "traces", {
        method: trace ? "PUT" : "POST", signal: controller.signal,
        body: { ...fields, latitude: sameLocation ? trace.latitude ?? null : null, longitude: sameLocation ? trace.longitude ?? null : null, ...(trace ? { version: trace.version } : {}) },
      });
      if (controller.signal.aborted) return;
      if (!saved?.id || saved.status !== "draft" || !Number.isInteger(saved.version) || saved.version < 1 || (trace && saved.id !== trace.id)) {
        throw new ApiError("The service returned an unexpected response.", "INVALID_RESPONSE");
      }
      if (!trace && photo) {
        setUploading(true);
        try {
          const media = await writeData(`traces/${encodeURIComponent(saved.id)}/media`, { method: "POST", file: photo, signal: controller.signal });
          if (controller.signal.aborted) return;
          if (!media?.id || media.trace_id !== saved.id || !PHOTO_TYPES.includes(media.mime_type)) throw new ApiError("Upload response could not be verified.", "INVALID_RESPONSE");
        } catch (failure) {
          if (controller.signal.aborted || failure.code === "CANCELLED") return;
          const attachment = failure.code === "MEDIA_ATTACH_FAILED" && typeof failure.details?.object_path === "string" ? failure.details.object_path : null;
          const uncertain = !attachment && (failure.code === "NETWORK_ERROR" || failure.code === "INVALID_RESPONSE" || failure.status >= 500);
          setInitialUpload({ file: photo, attachment, uncertain, error: attachment
            ? "Your photo uploaded, but attaching it failed. Retry attachment to use the existing upload."
            : uncertain ? "We could not confirm the photo upload. Reload saved attachments and check them before trying again." : failure.message });
          setSavedDraft({ ...saved, trace_media: saved.trace_media || [] });
          setDirty(false);
          return;
        } finally {
          if (!controller.signal.aborted) setUploading(false);
        }
      }
      setDirty(false);
      showToast("Draft saved. You can continue from My Contributions.");
      navigate(`/user/contributions/${encodeURIComponent(saved.id)}`, { replace: true });
    } catch (failure) {
      if (controller.signal.aborted || failure.code === "CANCELLED") return;
      const uncertain = failure.code === "NETWORK_ERROR" || failure.code === "INVALID_RESPONSE" || failure.status >= 500;
      if (failure.status === 409) {
        setBlocked(true);
        setError("This draft changed since you opened it. Copy any changes you want to keep, then reload the saved draft before editing again.");
      } else if (uncertain) {
        setBlocked(true);
        setError("We could not confirm whether your draft was saved. Keep a copy of your changes and check My Contributions before trying again.");
      } else setError(failure.message);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      request.current = null;
    }
  };

  if (savedDraft) return <>
    <div className="vhead"><h2>Draft saved</h2><p>Your Trace details are saved. Finish adding your photo below; you do not need to create another draft.</p></div>
    <Card><TracePhotos trace={savedDraft} contribution initialUpload={initialUpload} /></Card>
    <Link className="btn outline" style={{ marginTop: 16 }} to={`/user/contributions/${encodeURIComponent(savedDraft.id)}`}>Open saved draft</Link>
  </>;

  return <>
    <div className="vhead">
      <span className="eyebrow">Trace draft</span>
      <h2>{trace ? "Edit your draft" : "Start a trace"}</h2>
      <p>Choose a category and save your work. Title, location and description can be completed later. Saving keeps this as a draft; it does not submit it for review.</p>
    </div>
    <Card>
      <form onSubmit={save}>
        <RemoteState {...categories} />
        {!categories.loading && !categories.error && available.length === 0 && <p role="status">No categories are available. A category must be added before you can save a draft.</p>}
        <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
          <label className="lbl" htmlFor="draft-category">Category (required)</label>
          <select className="input" id="draft-category" name="category_id" required value={fields.category_id} onChange={change} disabled={categories.loading || Boolean(categories.error)}>
            <option value="">Choose a category</option>
            {fields.category_id && !validCategory && <option value={fields.category_id} disabled>Previous category unavailable — choose another</option>}
            {available.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <label className="lbl" htmlFor="draft-title" style={{ marginTop: 16 }}>Title</label>
          <input className="input" id="draft-title" name="title" maxLength={200} value={fields.title} onChange={change} />
          <label className="lbl" htmlFor="draft-location" style={{ marginTop: 16 }}>Location</label>
          <input className="input" id="draft-location" name="location_name" maxLength={300} placeholder="e.g. Lawis shoreline" value={fields.location_name} onChange={change} />
          <p className="hint">Enter the location name yourself. Map pinning is not available yet.{trace?.latitude != null && " Changing the location name clears the previously saved coordinates."}</p>
          <label className="lbl" htmlFor="draft-description" style={{ marginTop: 16 }}>Description</label>
          <textarea className="input" id="draft-description" name="description" maxLength={20000} rows={6} value={fields.description} onChange={change} />
          {!trace && <div style={{ marginTop: 16 }}>
            <label className="lbl" htmlFor="draft-photo">Choose a photo (optional)</label>
            <input ref={photoInput} id="draft-photo" type="file" accept={PHOTO_TYPES.join(",")} onChange={(event) => {
              const selected = event.target.files?.[0];
              setPhoto(null);
              setPhotoValidation("");
              if (!selected) return;
              const validation = photoError(selected);
              if (validation) { setPhotoValidation(validation); event.target.value = ""; return; }
              setPhoto(selected);
              setDirty(true);
            }} />
            <p className="hint">JPEG, PNG or WebP, up to 20 MB. Save draft will save your details and upload this photo. You can add more photos later.</p>
            {photoValidation && <p role="alert">{photoValidation}</p>}
            {photo && <><SelectedPhoto file={photo} /><p>{photo.name}</p><button className="btn outline sm" type="button" onClick={() => { setPhoto(null); if (photoInput.current) photoInput.current.value = ""; }}>Remove selected photo</button></>}
          </div>}
          <p className="hint">{trace && "Add more photos from the saved draft's detail page. "}Submitting for review will be available in a later update.</p>
          {uploading && <div role="status"><progress aria-label="Photo operation in progress" />Draft saved. Uploading and attaching photo…</div>}
          <p className="hint">{dirty ? "You have unsaved changes. Save before leaving this page." : "Changes are saved only when you choose Save draft."}</p>
          {error && <p role="alert">{error}</p>}
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn clay" type="submit" disabled={busy || blocked || !validCategory || Boolean(categories.error)}>{uploading ? "Uploading photo…" : busy ? "Saving…" : "Save draft"}</button>
            {blocked && trace && <button className="btn outline" type="button" onClick={onReload}>Discard local changes and reload saved draft</button>}
          </div>
        </fieldset>
      </form>
    </Card>
    <Link className="btn ghost sm" style={{ marginTop: 16 }} to="/user/contributions">Back to My Contributions</Link>
  </>;
}
