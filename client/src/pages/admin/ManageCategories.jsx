import React, { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";

export default function ManageCategories() {
  const { categories, addCategory, showToast } = useApp();
  const [name, setName] = useState("");

  const add = () => {
    if (!name.trim()) return;
    addCategory(name.trim());
    showToast("Category added");
    setName("");
  };

  return (
    <div className="wrap">
      <div className="vhead">
        <span className="eyebrow claye">Trace categories</span>
        <h2>Manage categories</h2>
        <p>Categories appear in the user's Upload Trace form and in analytics breakdowns.</p>
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <input className="input" placeholder="New category name…" style={{ maxWidth: 260 }} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <button className="btn blue sm" onClick={add}>Add</button>
        </div>
        <div className="chiprow">
          {categories.map((c) => <span key={c} className="chip on">{c}</span>)}
        </div>
      </div>
    </div>
  );
}
