import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import useRemoteData from "../hooks/useRemoteData.js";
import { ApiError } from "../api/auth.js";
import RemoteState from "./RemoteState.jsx";
import TraceFeedback from "./TraceFeedback.jsx";
import Card from "./Card.jsx";
import TracePhotos from "./TracePhotos.jsx";
import { traceValidation, hasAttachedPhoto } from "../api/traceValidation.js";
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
  const { readData, writeData, showToast, profile } = useApp();
  const navigate = useNavigate();
  const revision = trace?.status === "revision_requested";
  const saveLabel = revision ? "Save changes" : "Save draft";
  const categories = useRemoteData("categories", { collection: true });
  const [fields, setFields] = useState(() => ({ title: trace?.title || "", category_id: trace?.category_id || "", location_name: trace?.location_name || "", description: trace?.description || "" }));
  const [busy, setBusy] = useState(false);
  const [intent, setIntent] = useState("save");
  const [fieldErrors, setFieldErrors] = useState({});
  const [validating, setValidating] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");
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
  const validate = (values, action = intent, selectedPhoto = photo) => traceValidation(values, available, {
    requireDetails: action === "submit" || revision,
    requirePhoto: action === "submit", hasPhoto: Boolean(selectedPhoto) || hasAttachedPhoto(trace || {}),
  });
  const fieldProps = (name) => ({ "aria-invalid": Boolean(fieldErrors[name]), "aria-describedby": fieldErrors[name] ? `draft-${name}-error` : undefined });
  const fieldError = (name) => fieldErrors[name] ? <p id={`draft-${name}-error`} role="alert" style={{ color: "var(--clay)" }}>{fieldErrors[name]}</p> : null;
  const change = (event) => {
    const next = { ...fields, [event.target.name]: event.target.value };
    setFields(next);
    if (validating) setFieldErrors(validate(next));
    setDirty(true);
  };
  const save = async (event) => {
    event.preventDefault();
    const action = event.nativeEvent.submitter?.value === "save" ? "save" : "submit";
    if (request.current || blocked || savedDraft) return;
    setIntent(action);
    setValidating(true);
    const validation = validate(fields, action);
    setFieldErrors(validation);
    if (Object.keys(validation).length) {
      const name = Object.keys(validation)[0];
      document.getElementById(name === "category_id" ? "draft-category" : name === "location_name" ? "draft-location" : `draft-${name}`)?.focus();
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    let savedRecord = null;
    let submitting = false;
    try {
      const sameLocation = trace && fields.location_name.trim() === trace.location_name;
      const saved = await writeData(trace ? `traces/${encodeURIComponent(trace.id)}` : "traces", {
        method: trace ? "PUT" : "POST", signal: controller.signal,
        body: { ...fields, latitude: sameLocation ? trace.latitude ?? null : null, longitude: sameLocation ? trace.longitude ?? null : null, ...(trace ? { version: trace.version } : {}) },
      });
      if (controller.signal.aborted) return;
      if (!saved?.id || saved.status !== (trace?.status || "draft") || !Number.isInteger(saved.version) || saved.version < 1 || (trace && saved.id !== trace.id)) {
        throw new ApiError("The service returned an unexpected response.", "INVALID_RESPONSE");
      }
      savedRecord = saved;
      if (action === "submit" && !trace && photo) {
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
            ? "Your photo uploaded, but attaching it failed. Submit for review again to retry with the existing upload."
            : uncertain ? "We could not confirm the photo upload. Reload saved attachments and check them before trying again." : failure.message });
          setSavedDraft({ ...saved, trace_media: saved.trace_media || [] });
          setDirty(false);
          return;
        } finally {
          if (!controller.signal.aborted) setUploading(false);
        }
      }
      if (action === "submit") {
        const [latest, activeCategories] = await Promise.all([
          readData(`contributions/${encodeURIComponent(saved.id)}`, { signal: controller.signal }),
          readData("categories", { signal: controller.signal }),
        ]);
        if (controller.signal.aborted) return;
        if (latest?.id !== saved.id || latest.author_id !== profile.id || !Number.isInteger(latest.version) || !Array.isArray(latest.trace_media) || !Array.isArray(activeCategories)) throw new ApiError("Unable to verify the saved Trace before submission.", "INVALID_RESPONSE");
        savedRecord = latest;
        if (latest.status !== "pending") {
          if (!["draft", "revision_requested"].includes(latest.status) || latest.is_hidden || latest.deleted_at) throw new Error("This Trace is no longer available for submission.");
          const missing = traceValidation(latest, activeCategories, { hasPhoto: hasAttachedPhoto(latest) });
          if (Object.keys(missing).length) throw new Error(Object.values(missing).join(" "));
          if (["title", "description", "location_name", "category_id", "latitude", "longitude"].some((name) => (latest[name] ?? null) !== (saved[name] ?? null))) throw new Error("The saved details changed. Review the Trace before submitting again.");
          submitting = true;
          const submitted = await writeData(`traces/${encodeURIComponent(saved.id)}/submit`, { method: "POST", body: { version: latest.version }, signal: controller.signal });
          if (controller.signal.aborted) return;
          if (submitted?.id !== saved.id || submitted.status !== "pending" || !Number.isInteger(submitted.version) || submitted.version <= latest.version) throw new ApiError("Submission response could not be verified.", "INVALID_RESPONSE");
        }
        setDirty(false);
        showToast("Trace submitted for review.");
        navigate(`/user/contributions/${encodeURIComponent(saved.id)}`, { replace: true });
        return;
      }
      setDirty(false);
      showToast(revision ? "Changes saved. This Trace still needs revision until you resubmit it." : "Draft saved. You can continue from My Contributions.");
      navigate(`/user/contributions/${encodeURIComponent(saved.id)}`, { replace: true });
    } catch (failure) {
      if (controller.signal.aborted || failure.code === "CANCELLED") return;
      const uncertain = failure.code === "NETWORK_ERROR" || failure.code === "INVALID_RESPONSE" || failure.status >= 500;
      if (savedRecord) {
        setSavedDraft({ ...savedRecord, trace_media: savedRecord.trace_media || [] });
        setDirty(false);
        setRecoveryMessage(submitting && uncertain ? "Your details were saved, but we could not confirm submission. Open the saved Trace to check its status before trying again." : `Your details were saved, but submission did not complete: ${failure.message} Open the saved Trace to review it before trying again.`);
        return;
      }
      if (failure.status === 409) {
        setBlocked(true);
        setError(revision ? "This Trace changed since you opened it. Copy any changes you want to keep, then reload before editing again." : "This draft changed since you opened it. Copy any changes you want to keep, then reload the saved draft before editing again.");
      } else if (uncertain) {
        setBlocked(true);
        setError("We could not confirm whether your changes were saved. Keep a copy of your changes and check My Contributions before trying again.");
      } else setError(failure.message);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      request.current = null;
    }
  };

  if (savedDraft) return <>
    <div className="vhead"><h2>{recoveryMessage ? "Trace saved" : "Draft saved"}</h2><p>{recoveryMessage || "Your Trace details are saved. Submit for review below to finish uploading your photo and send this saved draft to the reviewer; you do not need to create another draft."}</p></div>
    {!recoveryMessage && <Card><TracePhotos trace={savedDraft} contribution initialUpload={initialUpload} /></Card>}
    <Link className="btn outline" style={{ marginTop: 16 }} to={`/user/contributions/${encodeURIComponent(savedDraft.id)}`}>{recoveryMessage ? "Open saved Trace" : "Open saved draft"}</Link>
  </>;

  return <>
    <div className="vhead">
      <span className="eyebrow">{revision ? "Requested revision" : "Trace draft"}</span>
      <h2>{revision ? "Edit requested revision" : trace ? "Edit your draft" : "Start a trace"}</h2>
      <p>{revision ? "Address the moderator’s feedback and save your changes. Keep the title, description and location complete. Save changes keeps the status as Needs revision; Resubmit for review saves your changes and sends them back to the reviewer." : "Submit your completed Trace for review, or save a draft and finish it later. A category is required to save a draft; submission also needs a title, location, description and photo."}</p>
    </div>
    {revision && <TraceFeedback id={trace.id} />}
    <Card>
      <form onSubmit={save} noValidate>
        <RemoteState {...categories} />
        {!categories.loading && !categories.error && available.length === 0 && <p role="status">No categories are available. A category must be added before you can save a draft.</p>}
        <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
          <label className="lbl" htmlFor="draft-category">Category (required)</label>
          <select className="input" id="draft-category" name="category_id" {...fieldProps("category_id")} required value={fields.category_id} onChange={change} disabled={categories.loading || Boolean(categories.error)}>
            <option value="">Choose a category</option>
            {fields.category_id && !validCategory && <option value={fields.category_id} disabled>Previous category unavailable — choose another</option>}
            {available.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          {fieldError("category_id")}
          <label className="lbl" htmlFor="draft-title" style={{ marginTop: 16 }}>Title</label>
          <input className="input" id="draft-title" required={revision} name="title" {...fieldProps("title")} maxLength={200} value={fields.title} onChange={change} />
          {fieldError("title")}
          <label className="lbl" htmlFor="draft-location" style={{ marginTop: 16 }}>Location</label>
          <input className="input" id="draft-location" required={revision} name="location_name" {...fieldProps("location_name")} maxLength={300} placeholder="e.g. Lawis shoreline" value={fields.location_name} onChange={change} />
          {fieldError("location_name")}
          <p className="hint">Enter the location name yourself. Map pinning is not available yet.{trace?.latitude != null && " Changing the location name clears the previously saved coordinates."}</p>
          <label className="lbl" htmlFor="draft-description" style={{ marginTop: 16 }}>Description</label>
          <textarea className="input" id="draft-description" required={revision} name="description" {...fieldProps("description")} maxLength={20000} rows={6} value={fields.description} onChange={change} />
          {fieldError("description")}
          {!trace && <div style={{ marginTop: 16 }}>
            <label className="lbl" htmlFor="draft-photo">Choose a photo (Required)</label>
            <input ref={photoInput} id="draft-photo" {...fieldProps("photo")} type="file" accept={PHOTO_TYPES.join(",")} onChange={(event) => {
              const selected = event.target.files?.[0];
              setPhoto(null);
              setPhotoValidation("");
              if (!selected) return;
              const validation = photoError(selected);
              if (validation) { setPhotoValidation(validation); event.target.value = ""; return; }
              setPhoto(selected);
              if (validating) setFieldErrors(validate(fields, intent, selected));
              setDirty(true);
            }} />
            <p className="hint">JPEG, PNG or WebP, up to 20 MB. Your selected photo uploads only when you submit. Save draft saves the details only; you will need to select the photo again when you return.</p>
            {fieldError("photo")}
            {photoValidation && <p role="alert">{photoValidation}</p>}
            {photo && <><SelectedPhoto file={photo} /><p>{photo.name}</p><button className="btn outline sm" type="button" onClick={() => { setPhoto(null); if (validating) setFieldErrors(validate(fields, intent, null)); if (photoInput.current) photoInput.current.value = ""; }}>Remove selected photo</button></>}
          </div>}
          {trace && <div><p className="hint">Manage attached photos from the saved Trace's detail page.</p>{fieldError("photo")}{fieldErrors.photo && <Link to={`/user/contributions/${trace.id}`}>Add a photo</Link>}</div>}
          {uploading && <div role="status"><progress aria-label="Photo operation in progress" />Draft saved. Uploading and attaching photo…</div>}
          <p className="hint">{dirty ? "You have unsaved changes. Save before leaving this page." : `Changes are saved only when you choose ${saveLabel}.`}</p>
          {error && <p role="alert">{error}</p>}
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn clay" type="submit" value="submit" disabled={busy || blocked || categories.loading || Boolean(categories.error)}>{busy && intent === "submit" ? (uploading ? "Uploading photo…" : "Submitting…") : revision ? "Resubmit for review" : "Submit Trace"}</button>
            <button className="btn outline" type="submit" value="save" disabled={busy || blocked || !validCategory || Boolean(categories.error)}>{busy && intent === "save" ? (uploading ? "Uploading photo…" : "Saving…") : saveLabel}</button>
            {blocked && trace && <button className="btn outline" type="button" onClick={onReload}>{revision ? "Discard local changes and reload Trace" : "Discard local changes and reload saved draft"}</button>}
          </div>
        </fieldset>
      </form>
    </Card>
    <Link className="btn ghost sm" style={{ marginTop: 16 }} to="/user/contributions">Back to My Contributions</Link>
  </>;
}
