import TracePhotoSelector from "./TracePhotoSelector.jsx";
import { compressPhoto } from "../api/compressPhoto.js";
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import useRemoteData from "../hooks/useRemoteData.js";
import { ApiError } from "../api/auth.js";
import RemoteState from "./RemoteState.jsx";
import TraceFeedback from "./TraceFeedback.jsx";
import TraceDraftLayout, { TraceDraftSection, TraceDraftSummary } from "./TraceDraftLayout.jsx";
import Card from "./Card.jsx";
import TraceMap from "./TraceMap.jsx";
import TracePhotos from "./TracePhotos.jsx";
import { traceValidation, hasAttachedPhoto } from "../api/traceValidation.js";
import { PHOTO_TYPES, photoError } from "../api/photos.js";

export default function TraceDraftForm({ trace = null, onReload }) {
  const { readData, writeData, showToast, profile } = useApp();
  const navigate = useNavigate();
  const revision = trace?.status === "revision_requested";
  const saveLabel = revision ? "Save changes" : "Save draft";
  const categories = useRemoteData("categories", { collection: true });
  const [fields, setFields] = useState(() => ({ title: trace?.title || "", category_id: trace?.category_id || "", location_name: trace?.location_name || "", description: trace?.description || "", latitude: trace?.latitude ?? null, longitude: trace?.longitude ?? null }));
  const [activeStep, setActiveStep] = useState("category");
  const jumpToStep = (step) => {
    setActiveStep(step);
    const section = document.getElementById(`trace-step-${step}`);
    section?.scrollIntoView?.({ block: "start" });
    section?.focus({ preventScroll: true });
  };
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [intent, setIntent] = useState("save");
  const [fieldErrors, setFieldErrors] = useState({});
  const [validating, setValidating] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [photo, setPhoto] = useState(null);
  const [photoValidation, setPhotoValidation] = useState("");
  const [uploading, setUploading] = useState(false);
  const [stage, setStage] = useState("Saving Trace…");
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
  const selectPhoto = async (files) => {
    if (busy || processingPhoto || !files?.length) return;
    const selected = files[0];
    const validation = files.length > 1 ? "Choose one photo at a time." : photoError(selected);
    setPhoto(null);
    setPhotoValidation(validation);
    if (photoInput.current) photoInput.current.value = "";
    if (validating) setFieldErrors(validate(fields, intent, validation ? null : selected));
    if (validation) return;
    if (profile.data_saver) {
      setProcessingPhoto(true);
      try { setPhoto(await compressPhoto(selected)); setDirty(true); }
      catch (failure) { setPhotoValidation(failure.message); }
      finally { setProcessingPhoto(false); }
    } else { setPhoto(selected); setDirty(true); }
  };
  const save = async (event) => {
    event.preventDefault();
    const action = event.nativeEvent.submitter?.value === "save" ? "save" : "submit";
    if (busy || processingPhoto || request.current || blocked || savedDraft) return;
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
    setStage(action === "save" ? "Saving draft…" : "Saving Trace…");
    setError("");
    let savedRecord = null;
    let submitting = false;
    try {
      const saved = await writeData(trace ? `traces/${encodeURIComponent(trace.id)}` : "traces", {
        method: trace ? "PUT" : "POST", signal: controller.signal,
        body: { ...fields, ...(trace ? { version: trace.version } : {}) },
      });
      if (controller.signal.aborted) return;
      if (!saved?.id || saved.status !== (trace?.status || "draft") || !Number.isInteger(saved.version) || saved.version < 1 || (trace && saved.id !== trace.id)) {
        throw new ApiError("The service returned an unexpected response.", "INVALID_RESPONSE");
      }
      savedRecord = saved;
      if (!trace && photo) {
        setUploading(true);
        setStage("Uploading photo…");
        let uploaded = null;
        try {
          const media = await writeData(`traces/${encodeURIComponent(saved.id)}/media`, { method: "POST", file: photo, signal: controller.signal });
          if (controller.signal.aborted) return;
          if (!media?.id || media.trace_id !== saved.id || !PHOTO_TYPES.includes(media.mime_type)) throw new ApiError("Upload response could not be verified.", "INVALID_RESPONSE");
          uploaded = media;
          if (action === "save") {
            const latest = await readData(`contributions/${encodeURIComponent(saved.id)}`, { signal: controller.signal });
            if (controller.signal.aborted) return;
            if (latest?.id !== saved.id || latest.author_id !== profile.id || !Number.isInteger(latest.version) || latest.version < saved.version || !Array.isArray(latest.trace_media) || !latest.trace_media.some((item) => item.id === media.id)) throw new ApiError("Unable to verify the saved photo. Reload saved attachments before trying again.", "INVALID_RESPONSE");
            savedRecord = latest;
          }
        } catch (failure) {
          if (controller.signal.aborted || failure.code === "CANCELLED") return;
          const attachment = failure.code === "MEDIA_ATTACH_FAILED" && typeof failure.details?.object_path === "string" ? failure.details.object_path : uploaded?.object_path || null;
          const uncertain = Boolean(uploaded) || (!attachment && (failure.code === "NETWORK_ERROR" || failure.code === "INVALID_RESPONSE" || failure.status >= 500));
          setInitialUpload({ file: photo, attachment, uncertain, error: attachment && !uncertain
            ? `Your photo uploaded, but attaching it failed. ${action === "save" ? "Retry attachment" : "Submit for review again"} to retry with the existing upload.`
            : uncertain ? "We could not confirm the photo upload. Reload saved attachments and check them before trying again." : failure.message });
          setSavedDraft({ ...saved, trace_media: saved.trace_media || [] });
          setDirty(false);
          return;
        } finally {
          if (!controller.signal.aborted) setUploading(false);
        }
      }
      if (action === "submit") {
        setStage("Submitting for review…");
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
    <div className="vhead"><h2>{recoveryMessage ? "Trace saved" : intent === "save" ? "Draft details saved" : "Draft saved"}</h2><p>{recoveryMessage || (intent === "save" ? "Your Trace details were saved. Recover the photo below before leaving, or open the saved draft. Saving a draft does not submit it for review." : "Your Trace details are saved. Submit for review below to finish uploading your photo and send this saved draft to the reviewer; you do not need to create another draft.")}</p></div>
    {!recoveryMessage && <Card><TracePhotos trace={savedDraft} contribution initialUpload={initialUpload} saveOnly={intent === "save"} /></Card>}
    <Link className="btn outline" style={{ marginTop: 16 }} to={`/user/contributions/${encodeURIComponent(savedDraft.id)}`}>{recoveryMessage ? "Open saved Trace" : "Open saved draft"}</Link>
  </>;

  return <>
    <div className="vhead">
      <span className="eyebrow">{revision ? "Requested revision" : "Trace draft"}</span>
      <h2>{revision ? "Edit requested revision" : trace ? "Edit your draft" : "Start a trace"}</h2>
      <p>{revision ? "Address the moderator’s feedback and save your changes. Keep the title, description and location complete. Save changes keeps the status as Needs revision; Resubmit for review saves your changes and sends them back to the reviewer." : "Submit your completed Trace for review, or save a draft and finish it later. A category is required to save a draft; submission also needs a title, location, description and photo."}</p>
    </div>
    {revision && <TraceFeedback id={trace.id} />}
    <TraceDraftLayout activeStep={activeStep} onSelect={jumpToStep} editing={Boolean(trace)}>
      <form onSubmit={save} noValidate>
        <RemoteState compact {...categories} />
        {!categories.loading && !categories.error && available.length === 0 && <p role="status">No categories are available. A category must be added before you can save a draft.</p>}
        <fieldset disabled={busy || processingPhoto} style={{ border: 0, padding: 0, margin: 0 }}>
          <TraceDraftSection step="category" onActivate={setActiveStep}>
          <label className="lbl" htmlFor="draft-category">Category (required)</label>
          <select className="input" id="draft-category" name="category_id" {...fieldProps("category_id")} required value={fields.category_id} onChange={change} disabled={categories.loading || Boolean(categories.error)}>
            <option value="">Choose a category</option>
            {fields.category_id && !validCategory && <option value={fields.category_id} disabled>Previous category unavailable — choose another</option>}
            {available.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          {fieldError("category_id")}
          </TraceDraftSection>
          <TraceDraftSection step="location" onActivate={setActiveStep}>
          <label className="lbl" htmlFor="draft-location" style={{ marginTop: 16 }}>Location</label>
          <input className="input" id="draft-location" required={revision} name="location_name" {...fieldProps("location_name")} maxLength={300} placeholder="e.g. Lawis shoreline" value={fields.location_name} onChange={change} />
          {fieldError("location_name")}
          <TraceMap latitude={fields.latitude} longitude={fields.longitude} disabled={busy || blocked} onChange={(point) => { setFields((current) => ({ ...current, ...point })); setDirty(true); }} />
          </TraceDraftSection>
          <TraceDraftSection step="description" onActivate={setActiveStep}>
          <label className="lbl" htmlFor="draft-title" style={{ marginTop: 16 }}>Title</label>
          <input className="input" id="draft-title" required={revision} name="title" {...fieldProps("title")} maxLength={200} value={fields.title} onChange={change} />
          {fieldError("title")}
          <label className="lbl" htmlFor="draft-description" style={{ marginTop: 16 }}>Description</label>
          <textarea className="input" id="draft-description" required={revision} name="description" {...fieldProps("description")} maxLength={20000} rows={6} value={fields.description} onChange={change} />
          {fieldError("description")}
          </TraceDraftSection>
          <TraceDraftSection step="photo" onActivate={setActiveStep}>
          {!trace && <TracePhotoSelector id="draft-photo" label="Choose a photo (required for submission)" inputRef={photoInput}
            file={photo} onSelect={selectPhoto} disabled={busy || processingPhoto || blocked} processing={processingPhoto} uploading={uploading}
            invalid={Boolean(fieldErrors.photo || photoValidation)} describedBy={[fieldErrors.photo && "draft-photo-error", photoValidation && "draft-photo-validation"].filter(Boolean).join(" ")}
            onRemove={() => { setPhoto(null); if (validating) setFieldErrors(validate(fields, intent, null)); if (photoInput.current) photoInput.current.value = ""; }}
            helper="JPEG, PNG or WebP, up to 20 MB. Save draft saves your details and selected photo so you can return later. A photo is required for submission, but optional for a draft.">
            {profile.data_saver && <p className="hint">Data saver is on. Preview your prepared photo before saving or submitting.</p>}
            {fieldError("photo")}
            {photoValidation && <p id="draft-photo-validation" role="alert">{photoValidation}</p>}
          </TracePhotoSelector>}
          {trace && <div><p className="hint">Manage attached photos from the saved Trace's detail page.</p>{fieldError("photo")}{fieldErrors.photo && <Link to={`/user/contributions/${trace.id}`}>Add a photo</Link>}</div>}
          </TraceDraftSection>
          <TraceDraftSection step="review" onActivate={setActiveStep}>
          {!trace && <TraceDraftSummary fields={fields} categories={available} photo={photo} />}
          <p className="hint">{dirty ? "You have unsaved changes. Save before leaving this page." : `Changes are saved only when you choose ${saveLabel}.`}</p>
          {error && <p role="alert">{error}</p>}
          <div className="trace-draft-actions">
            <button className="btn clay" type="submit" value="submit" disabled={busy || blocked || categories.loading || Boolean(categories.error)}>{busy && intent === "submit" && <span className="button-spinner" aria-hidden="true" />}{busy && intent === "submit" ? stage : revision ? "Resubmit for review" : "Submit Trace"}</button>
            <button className="btn outline" type="submit" value="save" disabled={busy || blocked || !validCategory || Boolean(categories.error)}>{busy && intent === "save" && <span className="button-spinner" aria-hidden="true" />}{busy && intent === "save" ? stage : saveLabel}</button>
            {blocked && trace && <button className="btn outline" type="button" onClick={onReload}>{revision ? "Discard local changes and reload Trace" : "Discard local changes and reload saved draft"}</button>}
          </div>
          </TraceDraftSection>
        </fieldset>
      </form>
    </TraceDraftLayout>
    <Link className="btn ghost sm" style={{ marginTop: 16 }} to="/user/contributions">Back to My Contributions</Link>
  </>;
}
