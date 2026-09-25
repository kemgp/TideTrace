import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";
import { ApiError } from "../../api/auth.js";
import useRemoteData from "../../hooks/useRemoteData.js";
import RemoteState from "../../components/RemoteState.jsx";
import TideLesson from "../../components/TideLesson.jsx";
import Card from "../../components/Card.jsx";
import { sampleTide } from "../../data/sampleTide.js";

const slugFor = (title) => title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 200).replace(/-$/, "");
const validLesson = (lesson) => lesson?.id && typeof lesson.title === "string" && typeof lesson.slug === "string" && typeof lesson.body === "string" && ["draft", "published", "archived"].includes(lesson.status) && typeof lesson.updated_at === "string" && Number.isFinite(Date.parse(lesson.updated_at));

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
  const [fields, setFields] = useState(() => ({ title: initial?.title || "", slug: initial?.slug || "", body: initial?.body || "" }));
  const [customSlug, setCustomSlug] = useState(Boolean(initial));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [preview, setPreview] = useState(false);
  const [dirty, setDirty] = useState(false);
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    const warn = (event) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const change = (event) => {
    const { name, value } = event.target;
    if (name === "slug") setCustomSlug(true);
    setFields((old) => ({ ...old, [name]: value, ...(name === "title" && !customSlug ? { slug: slugFor(value) } : {}) }));
    setErrors((old) => ({ ...old, [name]: "", ...(name === "title" && !customSlug ? { slug: "" } : {}) }));
    setDirty(true);
  };
  const run = async (status, reload = false) => {
    if (request.current || (!reload && blocked)) return;
    const nextErrors = {};
    if (!fields.title.trim() || fields.title.trim().length > 200) nextErrors.title = "Enter a title of up to 200 characters.";
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fields.slug.trim()) || fields.slug.trim().length > 200) nextErrors.slug = "Use up to 200 lowercase letters, numbers and single hyphens.";
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
        setSaved(latest); setFields({ title: latest.title, slug: latest.slug, body: latest.body }); setErrors({}); setDirty(false); setBlocked(false); return;
      }
      const body = { title: fields.title.trim(), slug: fields.slug.trim(), body: fields.body, status, ...(saved ? { updated_at: saved.updated_at } : {}) };
      writing = true;
      const lesson = await writeData(saved ? `admin/tides/${encodeURIComponent(saved.id)}` : "admin/tides", { method: saved ? "PUT" : "POST", body, signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!validLesson(lesson) || (saved && lesson.id !== saved.id) || lesson.status !== status || lesson.title !== body.title || lesson.slug !== body.slug || lesson.body !== body.body) throw new ApiError("The save response could not be verified.", "INVALID_RESPONSE");
      setDirty(false);
      showToast(status === "published" ? "Lesson published" : status === "archived" ? "Lesson archived" : "Lesson saved as draft");
      if (!saved) { navigate(`/admin/tides/${encodeURIComponent(lesson.id)}/edit`, { replace: true }); return; }
      setSaved(lesson); setFields({ title: lesson.title, slug: lesson.slug, body: lesson.body }); setCustomSlug(true);
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
  const fieldError = (name) => errors[name] && <p id={`tide-${name}-error`} role="alert" style={{ color: "var(--clay)" }}>{errors[name]}</p>;
  const fieldProps = (name) => ({ name, id: `tide-${name}`, value: fields[name], onChange: change, "aria-invalid": Boolean(errors[name]), "aria-describedby": errors[name] ? `tide-${name}-error` : undefined });
  return <>
    <div className="vhead"><h2>{saved ? "Edit lesson" : "Create a lesson"}</h2><p>Save a private draft, preview your content, then publish when it is ready.</p></div>
    <Card>
      <p><b>Saved status:</b> {saved?.status || "Not saved"}</p>
      <form noValidate onSubmit={(event) => { event.preventDefault(); run(saved?.status || "draft"); }}>
        <fieldset disabled={busy || blocked} style={{ border: 0, padding: 0, minWidth: 0 }}>
          {!saved && <button type="button" className="btn outline sm" onClick={() => { setFields({ ...sampleTide }); setCustomSlug(true); setErrors({}); setDirty(true); }}>Use sample lesson</button>}
          <label className="lbl" htmlFor="tide-title" style={{ marginTop: 16 }}>Lesson title</label><input className="input" maxLength={200} {...fieldProps("title")} />{fieldError("title")}
          <label className="lbl" htmlFor="tide-slug" style={{ marginTop: 16 }}>Slug</label><input className="input" maxLength={200} {...fieldProps("slug")} />{fieldError("slug")}<p className="hint">A unique lesson name using lowercase letters, numbers and hyphens. Suggested from the title until you edit it.</p>
          <label className="lbl" htmlFor="tide-body" style={{ marginTop: 16 }}>Lesson content</label><textarea className="input" rows={16} maxLength={100000} {...fieldProps("body")} />{fieldError("body")}<p className="hint">Plain text with line breaks. HTML is displayed as text. Saving changes to a published lesson updates what members read.</p>
          <div className="row" style={{ flexWrap: "wrap", gap: 8, marginTop: 16 }}>
            <button type="button" className="btn outline" onClick={() => setPreview((value) => !value)}>{preview ? "Hide preview" : "Preview"}</button>
            <button type="submit" className="btn blue">{saved?.status === "published" ? "Save published changes" : saved?.status === "archived" ? "Save archived changes" : "Save draft"}</button>
            {saved?.status !== "published" && <button type="button" className="btn clay" onClick={() => run("published")}>Publish</button>}
            {saved && saved.status !== "draft" && <button type="button" className="btn outline" onClick={() => run("draft")}>Return to draft</button>}
            {saved && saved.status !== "archived" && <button type="button" className="btn outline" onClick={() => run("archived")}>Archive</button>}
          </div>
        </fieldset>
      </form>
      <p className="hint">{dirty ? "You have unsaved changes. Save before leaving this page." : "Changes are saved only when you choose a save or publication action."}</p>
      {busy && <p role="status">Saving or checking lesson…</p>}
      {error && <p role="alert">{error}</p>}
      {blocked && saved && <button className="btn outline" disabled={busy} onClick={() => run(null, true)}>Discard local changes and reload saved lesson</button>}
    </Card>
    {preview && <section aria-label="Lesson preview" style={{ marginTop: 24 }}><h3>Preview - unsaved content</h3><Card><TideLesson title={fields.title} body={fields.body} /></Card></section>}
  </>;
}
