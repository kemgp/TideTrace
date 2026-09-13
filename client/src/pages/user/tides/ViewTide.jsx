import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../../../context/AppContext.jsx";
import Card from "../../../components/Card.jsx";

export default function ViewTide() {
  const { id } = useParams();
  const { tides, toggleTideProgress, showToast } = useApp();
  const navigate = useNavigate();
  const tide = tides.find((t) => t.id === id);

  if (!tide) {
    return (
      <div className="wrap" style={{ maxWidth: 760 }}>
        <p className="hint">Lesson not found.</p>
        <button className="btn ghost sm" onClick={() => navigate("/user/tides")}>← Back to Tides</button>
      </div>
    );
  }

  const complete = () => {
    toggleTideProgress(tide.id, 100);
    showToast("Marked as complete");
  };

  return (
    <div className="wrap" style={{ maxWidth: 760 }}>
      <button className="btn ghost sm" style={{ marginBottom: 14 }} onClick={() => navigate("/user/tides")}>
        ← Back to Tides
      </button>
      <Card>
        <span className="lbl">Tides · Lesson</span>
        <h2 style={{ fontSize: 19, marginBottom: 10 }}>{tide.title}</h2>
        <div className="chiprow" style={{ marginBottom: 16 }}>
          <span className="chip on">{tide.duration}</span>
          <span className="chip">{tide.module}</span>
        </div>
        <div className="row" style={{ marginBottom: 6 }}>
          <div style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--bg)", overflow: "hidden" }}>
            <i style={{ display: "block", height: "100%", width: `${tide.progress}%`, background: "var(--teal)", borderRadius: 4 }} />
          </div>
          <span className="hint">{tide.progress}%</span>
        </div>
        <div className="divider" />
        <span className="sk w90" />
        <span className="sk w80" style={{ marginTop: 8 }} />
        <span className="sk" style={{ marginTop: 8 }} />
        <div className="ph" style={{ height: 130, margin: "16px 0" }}>
          <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#5aa2a8" strokeWidth="1.8">
            <path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
            <path d="M2 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
          </svg>
          Lesson diagram / illustration
        </div>
        <span className="sk w90" />
        <span className="sk w70" style={{ marginTop: 8 }} />
        <div className="divider" />
        <div className="row between" style={{ flexWrap: "wrap", gap: 10 }}>
          {tide.progress < 100 ? (
            <button className="btn clay sm" onClick={complete}>Mark as complete</button>
          ) : (
            <span className="badge approved">Completed ✓</span>
          )}
        </div>
      </Card>
    </div>
  );
}
