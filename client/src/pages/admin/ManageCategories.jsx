import React, { useEffect, useRef, useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import useRemoteData from "../../hooks/useRemoteData.js";
import RemoteState, { Pagination } from "../../components/RemoteState.jsx";
import ContentTabs from "./ContentTabs.jsx";

export function CategoryEditor() {
  const { profile } = useApp();
  return <CategoryList key={profile.id} />;
}
function CategoryList() {
  const [notice, setNotice] = useState("");
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const result = useRemoteData(`admin/categories?limit=25&offset=${offset}`, { collection: true });
  const refresh = () => { setRevision(n => n + 1); result.retry(); };
  return <section>
    <p>Deactivate categories to remove them from new Trace selections. Existing Traces keep their category. Reactivate a category to make it available again.</p>
    <CategoryForm key={`new:${revision}`} onSaved={() => { setNotice("Category saved."); refresh(); }} />
    <button className="btn outline sm" disabled={result.loading} onClick={refresh}>Refresh categories</button>
    {notice && <p role="status">{notice}</p>}
    <RemoteState {...result} />
    {!result.loading && !result.error && <>
      {(result.data || []).map(category => <CategoryForm key={`${category.id}:${category.updated_at}:${revision}`} category={category} onSaved={() => { setNotice("Category saved."); refresh(); }} />)}
      {!result.data?.length && <p>No categories on this page.</p>}
    </>}
    <Pagination offset={offset} count={result.data?.length || 0} size={25} onChange={setOffset} loading={result.loading || Boolean(result.error)} />
  </section>;
}
function CategoryForm({ category, onSaved }) {
  const { writeData } = useApp();
  const [name, setName] = useState(category?.name || "");
  const [description, setDescription] = useState(category?.description || "");
  const [active, setActive] = useState(category?.is_active ?? true);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);
  async function save(event) {
    event.preventDefault();
    if (request.current || blocked) return;
    if (!name.trim()) { setError("Enter a category name."); return; }
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError("");
    try {
      const body = { name: name.trim(), description: description.trim() || null, is_active: active, ...(category ? { updated_at: category.updated_at } : {}) };
      const saved = await writeData(category ? `admin/categories/${category.id}` : "admin/categories", { method: category ? "PUT" : "POST", body, signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!saved?.id || (category && saved.id !== category.id) || saved.name !== body.name || saved.is_active !== active) throw new Error("Could not verify the saved category.");
      onSaved();
    } catch (failure) {
      if (controller.signal.aborted) return;
      const uncertain = !failure.status || failure.status >= 500 || failure.code === "STALE_VERSION";
      setBlocked(uncertain);
      setError(failure.code === "ALREADY_EXISTS" ? "A category with this name already exists. Check inactive categories too." : `${failure.message}${uncertain ? " Refresh categories and check the saved values before retrying." : ""}`);
    } finally { request.current = null; if (!controller.signal.aborted) setBusy(false); }
  }
  return <form className="card" style={{ marginBlock: 16 }} onSubmit={save} aria-label={category ? `Edit category ${category.name}` : "Create category"} noValidate>
    <h3>{category ? category.name : "New category"}</h3>
    {category && <p>{category.is_active ? "Active" : "Inactive"}</p>}
    <fieldset disabled={busy || blocked} style={{ border: 0, padding: 0 }}>
      <label>{category ? "Category name" : "New category name"}<input className="input" maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label>
      <label>Description<textarea className="input" maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} /></label>
      <label><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /> Active category</label>
      <button className="btn blue sm" type="submit">{busy ? "Saving…" : category ? "Save category" : "Add category"}</button>
    </fieldset>
    {error && <p role="alert">{error}</p>}
  </form>;
}
export default function ManageCategories() {
  return <div className="wrap">
    <div className="vhead"><span className="eyebrow claye">Manage content</span><h2>Topics &amp; lessons</h2><p>Manage educational content and organize trace categories.</p></div>
    <ContentTabs /><CategoryEditor />
  </div>;
}
