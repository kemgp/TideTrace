import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../../../context/AppContext.jsx";
import TraceStatusBadge from "../../../components/TraceStatusBadge.jsx";
import CommentSection from "../../../components/CommentSection.jsx";
import Card from "../../../components/Card.jsx";

export default function ViewTrace() {
  const { id } = useParams();
  const { traces, addComment } = useApp();
  const navigate = useNavigate();
  const trace = traces.find((t) => t.id === id);

  if (!trace) {
    return (
      <div className="wrap" style={{ maxWidth: 760 }}>
        <p className="hint">Trace not found.</p>
        <button className="btn ghost sm" onClick={() => navigate("/user/traces")}>← Back to Traces</button>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ maxWidth: 760 }}>
      <button className="btn ghost sm" style={{ marginBottom: 14 }} onClick={() => navigate("/user/traces")}>
        ← Back to Traces
      </button>
      <Card>
        <div className="row between" style={{ marginBottom: 12 }}>
          <TraceStatusBadge status={trace.status} />
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
        <CommentSection comments={trace.comments} onAdd={(text) => addComment(trace.id, text)} />
      </Card>
    </div>
  );
}
