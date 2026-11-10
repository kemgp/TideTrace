import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";
import { ApiError } from "../../api/auth.js";
import useRemoteData from "../../hooks/useRemoteData.js";
import RemoteState from "../../components/RemoteState.jsx";
import TideLesson from "../../components/TideLesson.jsx";
import Card from "../../components/Card.jsx";
import { useUnsavedChanges } from "../../components/NavigationGuard.jsx";
import "./EditTide.css";
import { countPdfPages } from "../../api/pdfDocument.js";
import { lessonShape } from "../../components/TideLesson.jsx";
import { MAX_IMPORT_BYTES, MAX_IMPORT_CHARS, prepareImport } from "../../api/importText.js";
import LessonImages from "./LessonImages.jsx";
import QuizEditor from "../../components/QuizEditor.jsx";
import { energyEnabled } from "../../api/energy.js";

const toFields = (lesson) => ({ title: lesson?.title || "", slug: lesson?.slug || "", body: lesson?.body || "", summary: lesson?.summary || "", category_id: lesson?.category_id || "", paged: Boolean(lesson?.paged) });
const COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];

const slugFor = (title) => title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 200).replace(/-$/, "");
const validLesson = (lesson) => lesson?.id && typeof lesson.title === "string" && typeof lesson.slug === "string" && typeof lesson.body === "string" && ["draft", "published", "archived"].includes(lesson.status) && typeof lesson.updated_at === "string" && Number.isFinite(Date.parse(lesson.updated_at));

const readText = (file) => typeof file.text === "function" ? file.text() : new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsText(file); });

export default function EditTide() {
  const { id } = useParams();
  const { profile } = useApp();
  const result = useRemoteData(id ? `admin/tides/${encodeURIComponent(id)}` : null);
  return <div className="wrap" style={{ maxWidth: 850 }}>
    <Link className="btn ghost sm" to="/admin/tides">← Back to Manage Tides</Link>
    {id && <RemoteState {...result} />}
    {(!id || result.data) && (id && !validLesson(result.data) ? <p role="alert">Unable to verify the lesson. Return to Manage Tides and reload it.</p> : <Editor key={`${profile.id}:${id || "new"}:${result.data?.updated_at || ""}`} initial={result.data} />)}
  </div>;
}

function Editor({ initial }) {
  const { writeData, readData, showToast } = useApp();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(initial);
  const [fields, setFields] = useState(() => toFields(initial));
  const topics = useRemoteData("categories", { collection: true });
  const [assetBusy, setAssetBusy] = useState("");
  const [assetError, setAssetError] = useState("");
  const [pending, setPending] = useState({ cover: null, slides: null });
  const hasPending = Boolean(pending.cover || pending.slides);
  const [customSlug, setCustomSlug] = useState(Boolean(initial));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [preview, setPreview] = useState(false);
  const [previewPart, setPreviewPart] = useState(1);
  const [importing, setImporting] = useState(null);
  const [importError, setImportError] = useState("");
  const [quizDirty, setQuizDirty] = useState(false);
  const bodyRef = useRef(null);
  const pictures = useRemoteData(saved ? `tides/${encodeURIComponent(saved.id)}/images` : null, { collection: true, keepPrevious: true });
  const pictureMap = new Map((pictures.data || []).map((image) => [image.id, image]));
  const shape = lessonShape(fields.body);
  const dirty = Object.keys(fields).some(name => fields[name] !== (name === "paged" ? Boolean(saved?.paged) : saved?.[name] || ""));
  const request = useRef(null);
  const allowNavigation = useUnsavedChanges(dirty || busy || Boolean(assetBusy) || hasPending || quizDirty, { onDiscard: () => request.current?.abort(), pendingRequest: busy });
  useEffect(() => () => request.current?.abort(), []);
  const change = (event) => {
    const { name, type, checked } = event.target;
    const value = type === "checkbox" ? checked : event.target.value;
    if (name === "slug") setCustomSlug(true);
    setFields((old) => ({ ...old, [name]: value, ...(name === "title" && !customSlug ? { slug: slugFor(value) } : {}) }));
    setErrors((old) => ({ ...old, [name]: "", ...(name === "title" && !customSlug ? { slug: "" } : {}) }));
  };
  const run = async (status, reload = false) => {
    if (request.current || (!reload && blocked)) return;
    const nextErrors = {};
    if (!fields.title.trim() || fields.title.trim().length > 200) nextErrors.title = "Enter a title of up to 200 characters.";
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fields.slug.trim()) || fields.slug.trim().length > 200) nextErrors.slug = "Use up to 200 lowercase letters, numbers and single hyphens.";
    if (fields.summary.length > 300) nextErrors.summary = "Keep the summary to 300 characters or fewer.";
    if (fields.body.length > 100000 || (status === "published" && !fields.body.trim())) nextErrors.body = "Add lesson content before publishing (up to 100,000 characters).";
    if (!reload) { setErrors(nextErrors); if (Object.keys(nextErrors).length) return; }
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError("");
    let writing = false;
    try {
      if (reload) {
        const latest = await readData(`admin/tides/${encodeURIComponent(saved.id)}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!validLesson(latest) || latest.id !== saved.id) throw new ApiError("Unable to verify the saved lesson.", "INVALID_RESPONSE");
        setSaved(latest); setFields(toFields(latest)); setErrors({}); setBlocked(false); return;
      }
      const body = { title: fields.title.trim(), slug: fields.slug.trim(), body: fields.body, summary: fields.summary.trim(), category_id: fields.category_id || null, paged: fields.paged, status, ...(saved ? { updated_at: saved.updated_at } : {}) };
      writing = true;
      const lesson = await writeData(saved ? `admin/tides/${encodeURIComponent(saved.id)}` : "admin/tides", { method: saved ? "PUT" : "POST", body, signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!validLesson(lesson) || (saved && lesson.id !== saved.id) || lesson.status !== status || lesson.title !== body.title || lesson.slug !== body.slug || lesson.body !== body.body || (lesson.summary ?? "") !== body.summary || (lesson.category_id ?? null) !== body.category_id || Boolean(lesson.paged) !== body.paged) throw new ApiError("The save response could not be verified.", "INVALID_RESPONSE");
      allowNavigation();
      let uploadFailed = "";
      if (!saved) {
        for (const kind of ["cover", "slides"]) {
          if (!pending[kind]) continue;
          try { await send(lesson.id, kind, pending[kind].file, pending[kind].pages); }
          catch (failure) { uploadFailed = `The lesson was saved, but the ${kind === "cover" ? "cover image" : "slides"} could not be uploaded (${failure.message}) Add ${kind === "cover" ? "it" : "them"} from the lesson page.`; }
        }
      }
      showToast(uploadFailed || (status === "published" ? "Lesson published" : status === "archived" ? "Lesson archived" : "Lesson saved as draft"));
      if (!saved) { navigate(`/admin/tides/${encodeURIComponent(lesson.id)}/edit`, { replace: true }); return; }
      setSaved(lesson); setFields(toFields(lesson)); setCustomSlug(true);
    } catch (failure) {
      if (controller.signal.aborted || failure.code === "CANCELLED") return;
      if (failure.code === "ALREADY_EXISTS") setErrors({ slug: "This slug is already used. Choose a different one." });
      else if (failure.status === 409) { setBlocked(true); setError("This lesson changed elsewhere. Copy any text you want to keep, then reload the saved lesson before editing again."); }
      else if (writing && (failure.code === "NETWORK_ERROR" || failure.code === "INVALID_RESPONSE" || failure.status >= 500)) { setBlocked(true); setError(saved ? "We could not confirm the save. Reload the saved lesson to check its status before trying again." : "We could not confirm creation. Check Manage Tides for the saved lesson before creating another."); }
      else setError(failure.message);
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  // Cover and slides are saved straight away (they need the saved lesson), and do not touch the text fields.
  // Check the file and, for slides, count its pages. Returns { pages } or { error }.
  const inspect = async (kind, file) => {
    const isCover = kind === "cover";
    if (isCover ? !COVER_TYPES.includes(file.type) : file.type !== "application/pdf") return { error: isCover ? "Choose a JPEG, PNG or WebP image." : "Choose a PDF. In PowerPoint, use File, Export, PDF." };
    if (file.size > (isCover ? 5 : 25) * 1024 * 1024) return { error: `That file is too large. The limit is ${isCover ? 5 : 25} MB.` };
    if (isCover) return {};
    let pages;
    try { pages = await countPdfPages(file); } catch { return { error: "That PDF could not be read. Export it again and retry." }; }
    return pages >= 1 && pages <= 500 ? { pages } : { error: "Slides can have 1 to 500 pages." };
  };
  const send = async (lessonId, kind, file, pages) => {
    const lesson = await writeData(`tides/${encodeURIComponent(lessonId)}/${kind}${kind === "slides" ? `?pages=${pages}` : ""}`, { method: "POST", file });
    if (!validLesson(lesson) || lesson.id !== lessonId || !lesson[`${kind}_path`]) throw new ApiError("The upload response could not be verified.", "INVALID_RESPONSE");
    return lesson;
  };
  // On a saved lesson the file uploads straight away. On a new lesson it is kept and uploaded right after the first save.
  const pick = async (kind, file) => {
    if (!file || assetBusy) return;
    setAssetError("");
    setAssetBusy(kind);
    try {
      const checked = await inspect(kind, file);
      if (checked.error) { setAssetError(checked.error); return; }
      if (!saved) { setPending((old) => ({ ...old, [kind]: { file, pages: checked.pages } })); return; }
      try {
        setSaved(await send(saved.id, kind, file, checked.pages));
        showToast(kind === "cover" ? "Cover image saved" : "Slides saved");
      } catch (failure) { setAssetError(failure.message); }
    } finally { setAssetBusy(""); }
  };
  const removeAsset = async (kind) => {
    if (!saved || assetBusy) return;
    setAssetError(""); setAssetBusy(kind);
    try {
      const lesson = await writeData(`tides/${encodeURIComponent(saved.id)}/${kind}`, { method: "DELETE" });
      if (!validLesson(lesson) || lesson.id !== saved.id || lesson[`${kind}_path`]) throw new ApiError("The removal could not be verified.", "INVALID_RESPONSE");
      setSaved(lesson);
      showToast(kind === "cover" ? "Cover image removed" : "Slides removed");
    } catch (failure) { setAssetError(failure.message); }
    finally { setAssetBusy(""); }
  };
  // Put an image reference into the text at the cursor, on its own paragraph.
  const insertImage = (image) => {
    const line = `![${String(image.alt).replace(/[\[\]]/g, "")}](image:${image.id})`;
    const area = bodyRef.current;
    setFields((old) => {
      const start = Math.min(area?.selectionStart ?? old.body.length, old.body.length);
      const end = Math.min(area?.selectionEnd ?? start, old.body.length);
      const before = old.body.slice(0, start);
      const after = old.body.slice(end);
      const lead = before ? (before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n") : "";
      const tail = after ? (after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n") : "";
      return { ...old, body: `${before}${lead}${line}${tail}${after}` };
    });
  };
  const forgetImage = (image) => setFields((old) => ({ ...old, body: old.body.split("\n").filter((line) => !line.includes(`(image:${image.id})`)).join("\n") }));
  const importFile = async (file) => {
    setImportError("");
    if (!file) return;
    if (!/\.(txt|md|markdown)$/i.test(file.name) && !/^text\//.test(file.type)) { setImportError("Choose a .txt or .md file."); return; }
    if (file.size > MAX_IMPORT_BYTES) { setImportError("That file is too large to import."); return; }
    const text = prepareImport(await readText(file));
    if (!text) { setImportError("That file is empty."); return; }
    if (text.length > MAX_IMPORT_CHARS) { setImportError("That file is longer than the 100,000 character limit."); return; }
    if (fields.body.trim()) { setImporting({ name: file.name, text }); return; }
    applyImport(file.name, text);
  };
  const applyImport = (name, text) => {
    setFields((old) => ({ ...old, body: text }));
    setErrors((old) => ({ ...old, body: "" }));
    setImporting(null);
    showToast(`Imported ${name}`);
  };
  const fieldError = (name) => errors[name] && <p id={`tide-${name}-error`} role="alert" style={{ color: "var(--danger)" }}>{errors[name]}</p>;
  const fieldProps = (name) => ({ name, id: `tide-${name}`, value: fields[name], onChange: change, "aria-invalid": Boolean(errors[name]), "aria-describedby": errors[name] ? `tide-${name}-error` : undefined });
  return <>
    <div className="vhead"><h2>{saved ? "Edit lesson" : "Create a lesson"}</h2><p>Save a private draft, preview your content, then publish when it is ready.</p></div>
    <Card>
      <p><b>Saved status:</b> {saved?.status || "Not saved"}</p>
      <form noValidate className="tide-form" onSubmit={(event) => { event.preventDefault(); run(saved?.status || "draft"); }}>
        <fieldset disabled={busy || blocked} style={{ border: 0, padding: 0, minWidth: 0 }}>
          <label className="lbl" htmlFor="tide-title">Lesson title</label><input className="input" maxLength={200} {...fieldProps("title")} />{fieldError("title")}
          <div className="tide-row">
            <div className="tide-cell">
              <label className="lbl" htmlFor="tide-slug">Slug</label><input className="input" maxLength={200} {...fieldProps("slug")} />{fieldError("slug")}<p className="hint">Lowercase letters, numbers and hyphens. Suggested from the title until you edit it.</p>
            </div>
            <div className="tide-cell">
              <label className="lbl" htmlFor="tide-category_id">Topic</label>
              <select className="input" {...fieldProps("category_id")}><option value="">No topic</option>{(topics.data || []).map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select>
            </div>
          </div>
          <label className="lbl" htmlFor="tide-summary">Summary</label><textarea className="input" rows={2} maxLength={300} {...fieldProps("summary")} />{fieldError("summary")}<p className="hint">Shown on the lesson card. {fields.summary.length}/300</p>
          <label className="lbl" htmlFor="tide-body">{saved?.slides_path ? "Lesson content (text version of the slides)" : "Lesson content"}</label><textarea ref={bodyRef} className="input" rows={16} maxLength={100000} {...fieldProps("body")} />{fieldError("body")}<p className="hint">Use ## for a heading, - for a bullet, 1. for a step, **bold** for bold.</p>
          <div className="tide-import">
            <label htmlFor="tide-import-file">Import from a file (.txt or .md)</label>
            <input id="tide-import-file" type="file" accept=".txt,.md,.markdown,text/plain,text/markdown" onChange={(event) => { importFile(event.target.files?.[0]); event.target.value = ""; }} />
          </div>
          {importError && <p role="alert" style={{ color: "var(--danger)" }}>{importError}</p>}
          {importing && <p role="alert">Replace the current content with {importing.name}? <button type="button" className="btn outline sm" onClick={() => applyImport(importing.name, importing.text)}>Replace</button> <button type="button" className="btn ghost sm" onClick={() => setImporting(null)}>Cancel</button></p>}
          <label className="tide-check" htmlFor="tide-paged"><input type="checkbox" id="tide-paged" name="paged" checked={fields.paged} onChange={change} /> Show in chapters</label>
          <p className="hint">{saved?.slides_path ? "Lessons with slides are not split into chapters." : fields.paged ? (shape.chapters >= 2 ? `Each ## heading starts a chapter. ${shape.chapters} chapters found.` : "Add at least two ## headings to make chapters.") : "Each ## heading will start a new chapter, with a contents list and Previous and Next buttons."}</p>
          <div className="row" style={{ flexWrap: "wrap", gap: 8, marginTop: 16 }}>
            <button type="button" className="btn outline" onClick={() => setPreview((value) => !value)}>{preview ? "Hide preview" : "Preview"}</button>
            <button type="submit" className={saved?.status === "published" ? "btn blue" : "btn outline"}>{saved?.status === "published" ? "Save published changes" : saved?.status === "archived" ? "Save archived changes" : "Save draft"}</button>
            {saved?.status !== "published" && <button type="button" className="btn blue" onClick={() => run("published")}>Publish</button>}
            {saved && saved.status !== "draft" && <button type="button" className="btn outline" onClick={() => run("draft")}>Return to draft</button>}
            {saved && saved.status !== "archived" && <button type="button" className="btn outline" onClick={() => run("archived")}>Archive</button>}
          </div>
        </fieldset>
      </form>
      {dirty && <p className="hint">You have unsaved changes. Save before leaving this page.</p>}
      {busy && <p role="status">Saving or checking lesson…</p>}
      {error && <p role="alert">{error}</p>}
      {blocked && saved && <button className="btn outline" disabled={busy} onClick={() => run(null, true)}>Discard local changes and reload saved lesson</button>}
    </Card>
    <Card>
      <h3 style={{ marginTop: 0 }}>Cover image and slides</h3><p className="hint" style={{ marginTop: 0 }}>Optional. Members flip through slides page by page, with the lesson content below as the text version.</p>
      <div className="lesson-assets">
        {[["cover", "Cover image", "JPEG, PNG or WebP, up to 5 MB.", COVER_TYPES.join(",")], ["slides", "Slides (PDF)", "PDF exported from PowerPoint, up to 25 MB.", "application/pdf"]].map(([kind, title, hint, accept]) => {
          const isCover = kind === "cover";
          const stored = saved?.[`${kind}_path`];
          const staged = pending[kind];
          const pages = isCover ? null : (stored ? saved.slides_pages : staged?.pages);
          const summary = stored ? `${isCover ? "Cover image uploaded" : "Slides uploaded"}${pages ? ` · ${pages} ${pages === 1 ? "page" : "pages"}` : ""}` : staged ? `${staged.file.name}${pages ? ` · ${pages} ${pages === 1 ? "page" : "pages"}` : ""}` : "";
          return <div className="lesson-asset" key={kind}>
            {summary ? <span className="lbl">{title}</span> : <label className="lbl" htmlFor={`tide-${kind}-file`}>{title}</label>}
            {summary
              ? <>
                <p className="asset-chip">{summary}</p>
                {staged && !stored && <p className="hint">Uploads when you save.</p>}
                <button type="button" className="btn outline sm" disabled={Boolean(assetBusy)} onClick={() => (stored ? removeAsset(kind) : setPending((old) => ({ ...old, [kind]: null })))}>{stored ? (isCover ? "Remove cover image" : "Remove slides") : "Clear selection"}</button>
              </>
              : <>
                <p className="hint">{hint}</p>
                <input id={`tide-${kind}-file`} type="file" accept={accept} disabled={Boolean(assetBusy) || busy} onChange={(event) => { pick(kind, event.target.files?.[0]); event.target.value = ""; }} />
              </>}
          </div>;
        })}
      </div>
      {saved
        ? <LessonImages lessonId={saved.id} images={pictures.data || []} loading={pictures.loading} error={pictures.error} retry={pictures.retry} disabled={busy || Boolean(assetBusy)} onInsert={insertImage} onRemoved={forgetImage} />
        : <p className="hint" style={{ marginTop: 16 }}>Save the lesson once to add images to its text.</p>}
      {assetBusy && <p role="status">{assetBusy === "cover" ? "Uploading cover image…" : "Uploading slides…"}</p>}
      {assetError && <p role="alert" style={{ color: "var(--danger)" }}>{assetError}</p>}
    </Card>
    {energyEnabled() && (saved
      ? <QuizEditor tideId={saved.id} tideStatus={saved.status} onDirtyChange={setQuizDirty} />
      : <Card><h3 style={{ marginTop: 0 }}>Quiz</h3><p className="hint" style={{ margin: 0 }}>Save the lesson once to add a quiz.</p></Card>)}
    {preview && <section aria-label="Lesson preview" style={{ marginTop: 24 }}><h3>Preview - unsaved content</h3><Card><TideLesson title={fields.title} body={fields.body} images={pictureMap} paged={fields.paged && !saved?.slides_path} part={previewPart} onPart={setPreviewPart} /></Card></section>}
  </>;
}
