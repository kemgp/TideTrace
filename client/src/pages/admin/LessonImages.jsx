import React, { useRef, useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { ApiError } from "../../api/auth.js";

const TYPES = ["image/jpeg", "image/png", "image/webp"];

// Images placed inside a lesson's text: add one with a description, put it into the text, or delete it.
export default function LessonImages({ lessonId, images, loading, error, retry, disabled, onInsert, onRemoved }) {
  const { writeData, showToast } = useApp();
  const [file, setFile] = useState(null);
  const [alt, setAlt] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const input = useRef(null);
  const add = async () => {
    setMessage("");
    if (!TYPES.includes(file?.type)) { setMessage("Choose a JPEG, PNG or WebP image."); return; }
    if (file.size > 5 * 1024 * 1024) { setMessage("That file is too large. The limit is 5 MB."); return; }
    if (!alt.trim() || alt.trim().length > 200) { setMessage("Describe the image in up to 200 characters."); return; }
    setBusy("add");
    try {
      const image = await writeData(`tides/${encodeURIComponent(lessonId)}/images?alt=${encodeURIComponent(alt.trim())}`, { method: "POST", file });
      if (!image?.id || typeof image.alt !== "string") throw new ApiError("The upload response could not be verified.", "INVALID_RESPONSE");
      onInsert(image);
      setFile(null); setAlt("");
      if (input.current) input.current.value = "";
      retry();
      showToast("Image added and placed in the text");
    } catch (failure) { setMessage(failure.message); }
    finally { setBusy(""); }
  };
  const remove = async (image) => {
    setMessage(""); setBusy(image.id);
    try {
      await writeData(`tides/${encodeURIComponent(lessonId)}/images/${encodeURIComponent(image.id)}`, { method: "DELETE" });
      onRemoved(image);
      retry();
      showToast("Image deleted");
    } catch (failure) { setMessage(failure.message); }
    finally { setBusy(""); }
  };
  const locked = Boolean(busy) || disabled;
  return <div className="lesson-images">
    <h4>Images in the text</h4>
    <p className="hint">New images are placed in the text at your cursor. JPEG, PNG or WebP, up to 5 MB.</p>
    <div className="lesson-images__add">
      <label className="lbl" htmlFor="tide-image-file">Image file</label>
      <input id="tide-image-file" ref={input} type="file" accept={TYPES.join(",")} disabled={locked} onChange={(event) => setFile(event.target.files?.[0] || null)} />
      <label className="lbl" htmlFor="tide-image-alt">Description for screen readers</label>
      <input id="tide-image-alt" className="input" maxLength={200} value={alt} disabled={locked} onChange={(event) => setAlt(event.target.value)} />
      <button type="button" className="btn outline sm" disabled={locked || !file || !alt.trim()} onClick={add}>Add image</button>
    </div>
    {message && <p role="alert" className="lesson-images__error">{message}</p>}
    {error && <p role="alert" className="lesson-images__error">{error} <button type="button" className="btn ghost sm" onClick={retry}>Try again</button></p>}
    {loading && <p role="status">Loading images…</p>}
    {!loading && !error && images.length > 0 && <ul className="lesson-images__list">
      {images.map((image) => <li key={image.id}>
        {image.url ? <img src={image.url} alt="" /> : <span className="lesson-images__blank" aria-hidden="true" />}
        <span className="lesson-images__alt">{image.alt}</span>
        <button type="button" className="btn ghost sm" disabled={locked} onClick={() => onInsert(image)}>Insert in text</button>
        <button type="button" className="btn ghost sm" disabled={locked} onClick={() => remove(image)} aria-label={`Delete image: ${image.alt}`}>Delete</button>
      </li>)}
    </ul>}
  </div>;
}
