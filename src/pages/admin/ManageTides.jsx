import React, { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";

export default function ManageTides() {
  const { tides, addTide, showToast } = useApp();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("");

  const save = () => {
    if (!title) return;
    addTide({ title, duration: duration || "5 min", module: "New topic" });
    showToast("Content saved as draft");
    setOpen(false);
    setTitle("");
    setDuration("");
  };

  return (
    <div className="wrap">
      <div className="vhead">
        <div className="headrow">
          <div>
            <span className="eyebrow claye">Manage content — Tides</span>
            <h2>Topics &amp; lessons</h2>
            <p>Add, edit, publish, or unpublish educational content.</p>
          </div>
          <button className="btn blue sm" onClick={() => setOpen(true)}>＋ Add content</button>
        </div>
      </div>

      <div className="card">
        {tides.map((t) => (
          <div className="lrow" key={t.id}>
            <div className="grow">
              <div className="t">{t.title}</div>
              <div className="m"><span>{t.module}</span> · <span>{t.duration}</span></div>
            </div>
            <span className={`badge ${t.progress === 100 ? "approved" : "draft"}`}>{t.progress === 100 ? "Published" : "Draft"}</span>
          </div>
        ))}
      </div>

      {open && (
        <div className="modal" style={{ display: "grid" }}>
          <div className="mcard">
            <h3>Add Tides content</h3>
            <div className="fgroup"><label>Lesson title</label><input className="input" placeholder="Understanding marine sanctuaries" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="fgroup"><label>Duration</label><input className="input" placeholder="10 min" value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
            <div className="mrow">
              <button className="btn outline sm" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn blue sm" onClick={save}>Save content</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
