import React, { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import ContentTabs from "./ContentTabs.jsx";

export function CategoryEditor() {
  const { categories, addCategory, removeCategory, showToast } = useApp();
  const [name, setName] = useState("");
  const add = (event) => {
    event.preventDefault();
    if (!name.trim()) return;
    addCategory(name.trim());
    showToast("Demo category added for this session");
    setName("");
  };
  return <div className="card">
    <form className="row admin-category-form" onSubmit={add}>
      <input aria-label="New category name" className="input" placeholder="New category name…" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} required />
      <button className="btn blue sm" type="submit">Add</button>
    </form>
    <div className="chiprow">{categories.map((category) => <span key={category} className="chip on">{category}<button type="button" className="admin-chip-remove" aria-label={`Remove ${category}`} onClick={() => removeCategory(category)}>×</button></span>)}</div>
    <p className="hint admin-note">Demo categories only. Changes last for this session and do not change the live Upload Trace form.</p>
  </div>;
}
export default function ManageCategories() {
  return <div className="wrap">
    <div className="vhead"><span className="eyebrow claye">Manage content — Tides</span><h2>Topics &amp; lessons</h2><p>Manage educational content and organize trace categories.</p></div>
    <ContentTabs /><CategoryEditor />
  </div>;
}
