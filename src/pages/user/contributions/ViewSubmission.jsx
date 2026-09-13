import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../../../context/AppContext.jsx";
import TraceStatusBadge from "../../../components/TraceStatusBadge.jsx";
import Card from "../../../components/Card.jsx";
import Button from "../../../components/Button.jsx";

export default function ViewSubmission() {
  const { id } = useParams();
  const { traces } = useApp();
  const navigate = useNavigate();
  const trace = traces.find((t) => t.id === id);

  if (!trace) {
    return (
      <div className="wrap" style={{ maxWidth: 760 }}>
        <p className="hint">Submission not found.</p>
        <button className="btn ghost sm" onClick={() => navigate("/user/contributions")}>← Back</button>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ maxWidth: 760 }}>
      <button className="btn ghost sm" style={{ marginBottom: 14 }} onClick={() => navigate("/user/contributions")}>
        ← Back to My Contributions
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
        <div className="divider" />
        <span className="lbl">Description</span>
        <p style={{ fontSize: "12.5px", lineHeight: 1.7 }}>{trace.description}</p>

        {(trace.status === "revision" || trace.status === "rejected") && trace.note && (
          <>
            <div className="divider" />
            <div className="flag"><b>Moderator feedback</b>{trace.note}</div>
          </>
        )}

        {trace.status === "revision" && (
          <div style={{ marginTop: 16 }}>
            <Button variant="clay" onClick={() => navigate(`/user/contributions/${trace.id}/edit`)}>
              Edit &amp; resubmit
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
