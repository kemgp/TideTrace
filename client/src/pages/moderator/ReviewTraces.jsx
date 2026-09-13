import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";
import TraceStatusBadge from "../../components/TraceStatusBadge.jsx";

export default function ReviewTraces() {
  const { traces, decideTrace, showToast } = useApp();
  const location = useLocation();
  const [selected, setSelected] = useState(location.state?.open || null);
  const [note, setNote] = useState("");

  const pending = traces.filter((t) => t.status === "pending");
  const trace = traces.find((t) => t.id === selected);

  const decide = (status) => {
    decideTrace(trace.id, status, note);
    showToast(`Trace marked as ${status}`);
    setNote("");
    setSelected(null);
  };

  if (trace) {
    return (
      <div className="wrap" style={{ maxWidth: 760 }}>
        <button className="btn ghost sm" style={{ marginBottom: 14 }} onClick={() => setSelected(null)}>
          ← Back to queue
        </button>
        <div className="card">
          <div className="row between" style={{ marginBottom: 12 }}>
            <span className="badge pending">Pending review</span>
            <span className="hint">{trace.when}</span>
          </div>
          <div className="media">Photo / video media</div>
          <h2 style={{ fontSize: 19, margin: "16px 0 10px" }}>{trace.title}</h2>
          <div className="chiprow" style={{ marginBottom: 14 }}>
            <span className="chip on">{trace.category}</span>
            <span className="chip">{trace.location}</span>
          </div>
          <div className="row">
            <span className="avatar" style={{ background: "var(--tan)" }} />
            <span className="hint">{trace.author}</span>
          </div>
          <div className="divider" />
          <span className="lbl">Description</span>
          <p style={{ fontSize: "12.5px", lineHeight: 1.7 }}>{trace.description}</p>
          <div className="divider" />
          <div className="decision" style={{ marginTop: 6 }}>
            <h3>Decision?</h3>
            <p>Approve publishes the trace to the community archive · Request revision sends feedback to the user · Reject removes it with a reason.</p>
            <span className="lbl">Feedback / reason to the user</span>
            <textarea
              className="input"
              style={{ height: 70 }}
              placeholder="Optional — shown in the user's notification and My Contributions."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="row" style={{ flexWrap: "wrap", marginTop: 14 }}>
              <button className="btn teal" onClick={() => decide("approved")}>✓ Approve &amp; publish</button>
              <button className="btn clay" onClick={() => decide("revision")}>✎ Request revision</button>
              <button className="btn outline" style={{ color: "var(--clay)", borderColor: "var(--clay)" }} onClick={() => decide("rejected")}>
                ✕ Reject
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="vhead">
        <div className="headrow">
          <div>
            <span className="eyebrow teale">Review traces</span>
            <h2>Pending submissions</h2>
            <p>Select a trace to review its content — photo/video, location, and description — then decide.</p>
          </div>
        </div>
      </div>

      {pending.length ? (
        <div className="card">
          {pending.map((t) => (
            <div className="lrow click" key={t.id} onClick={() => setSelected(t.id)}>
              <div className="grow">
                <div className="t">{t.title}</div>
                <div className="m"><span>{t.author}</span> · <span>{t.location}</span> · <span>{t.when}</span></div>
              </div>
              <TraceStatusBadge status={t.status} />
            </div>
          ))}
        </div>
      ) : (
        <div className="ph" style={{ marginTop: 10 }}>🎉 Queue clear — every submission has been reviewed.</div>
      )}
    </div>
  );
}
