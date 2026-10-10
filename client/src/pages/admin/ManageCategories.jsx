import { PAGE_SIZE } from "../../api/pagination.js";
import React, { useEffect, useRef, useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import useRemoteData from "../../hooks/useRemoteData.js";
import RemoteState, { Pagination } from "../../components/RemoteState.jsx";
import ContentTabs from "./ContentTabs.jsx";
import "./ManageCategories.css";

export function CategoryEditor() {
  const { profile } = useApp();
  return <CategoryList key={profile.id} />;
}
function CategoryList() {
  const [notice, setNotice] = useState("");
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState(null);
  const result = useRemoteData(`admin/categories?limit=${PAGE_SIZE}&offset=${offset}`, { collection: true });
  const refresh = () => { setRevision(n => n + 1); result.retry(); };
  return <section className="category-editor">
    <header className="category-editor__heading"><h3>Trace categories</h3><p>Organize the topics available for new Traces. Deactivating a category keeps it on existing Traces; reactivate it to make it available again.</p></header>
    <CategoryForm key={`new:${revision}`} onSaved={() => { setNotice("Category saved."); refresh(); }} />
    <div className="category-editor__toolbar"><h4>Saved categories</h4><button className="btn outline sm" disabled={result.loading} onClick={refresh}>Refresh categories</button></div>
    {notice && <p role="status">{notice}</p>}
    <RemoteState {...result} />
    {!result.loading && !result.error && <>
      {!!result.data?.length && <div className="card category-list">{result.data.map(category => <div className="category-list__item" key={category.id}>
        <div className="category-list__row"><div className="category-list__copy"><h4>{category.name}</h4><p>{category.description || "No description provided."}</p></div><span className={`badge ${category.is_active ? "active" : "removed"}`}>{category.is_active ? "Active" : "Inactive"}</span><button type="button" className="btn outline sm" aria-label={`${editing === category.id ? "Close" : "Edit"} category ${category.name}`} aria-expanded={editing === category.id} aria-controls={`category-${category.id}`} onClick={() => setEditing(editing === category.id ? null : category.id)}>{editing === category.id ? "Close" : "Edit"}</button></div>
        {editing === category.id && <div id={`category-${category.id}`}><CategoryForm key={`${category.id}:${category.updated_at}:${revision}`} category={category} onSaved={() => { setNotice("Category saved."); refresh(); }} /></div>}
      </div>)}</div>}
      {!result.data?.length && <p>No categories on this page.</p>}
    </>}
    <Pagination offset={offset} count={result.data?.length || 0} size={PAGE_SIZE} onChange={setOffset} loading={result.loading || Boolean(result.error)} />
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
  return <form className="card category-form" onSubmit={save} aria-label={category ? `Edit category ${category.name}` : "Create category"} noValidate>
    <header className="category-form__heading"><h4>{category ? `Edit ${category.name}` : "New category"}</h4>{category && <span className={`badge ${category.is_active ? "active" : "removed"}`}>{category.is_active ? "Active" : "Inactive"}</span>}</header>
    <fieldset disabled={busy || blocked} style={{ border: 0, padding: 0 }}>
      <div className="category-form__fields"><label>{category ? "Category name" : "New category name"}<input className="input" maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label>
      <label>Description<textarea className="input" rows={3} maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} /></label></div>
      <div className="category-form__actions"><label><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /> Active category</label>
      <button className="btn blue sm" type="submit">{busy ? "Saving…" : category ? "Save category" : "Add category"}</button></div>
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
