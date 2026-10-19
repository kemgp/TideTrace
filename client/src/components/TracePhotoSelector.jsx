import React, { useState } from "react";
import SelectedPhoto from "./SelectedPhoto.jsx";
import { PHOTO_TYPES } from "../api/photos.js";
import "./TracePhotoUpload.css";

export default function TracePhotoSelector({ id, label, inputRef, file, onSelect, onRemove, disabled = false, removeDisabled = disabled,
  removeLabel = "Remove selected photo", processing = false, uploading = false, helper, invalid = false, describedBy, children }) {
  const [dragging, setDragging] = useState(false);
  const select = (files) => {
    if (!disabled && files?.length) onSelect(files);
  };
  const description = [`${id}-hint`, describedBy].filter(Boolean).join(" ");
  return <div className="trace-photo-upload">
    <label className="lbl" htmlFor={id}>{label}</label>
    <div className="trace-photo-upload__card">
      <div className={`trace-photo-upload__drop${dragging && !disabled ? " is-dragging" : ""}${disabled ? " is-disabled" : ""}`}
        onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
        onDrop={(event) => { event.preventDefault(); setDragging(false); select(event.dataTransfer.files); }}>
        <svg className="trace-photo-upload__icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 33H11a8 8 0 0 1-2-15.7A12 12 0 0 1 32 13a10 10 0 0 1 5 20h-5M24 40V21m-7 7 7-7 7 7" />
        </svg>
        <strong>Drag and drop your photo here</strong>
        <span>or</span>
        <input className="trace-photo-upload__input" ref={inputRef} id={id} type="file" accept={PHOTO_TYPES.join(",")}
          disabled={disabled} tabIndex={-1} aria-invalid={invalid} aria-describedby={description}
          onChange={(event) => select(event.target.files)} />
        <button className="trace-photo-upload__browse" type="button" disabled={disabled} aria-controls={id} aria-describedby={description}
          onClick={() => inputRef.current?.click()}>Browse files</button>
      </div>
      {processing && <p role="status">Preparing smaller photo…</p>}
      {file && <div className="trace-photo-upload__row">
        <SelectedPhoto file={file} />
        <div className="trace-photo-upload__details"><span className="trace-photo-upload__name">{file.name}</span><small>{file.size < 1024 * 1024 ? `${Math.max(1, Math.ceil(file.size / 1024))} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`} · {uploading ? "Uploading…" : "Ready to upload"}</small></div>
        {onRemove && <button className="trace-photo-upload__remove" type="button" disabled={removeDisabled} aria-label={removeLabel} title={removeLabel} onClick={onRemove}>×</button>}
      </div>}
    </div>
    <p className="hint" id={`${id}-hint`}>{helper}</p>
    {children}
  </div>;
}
