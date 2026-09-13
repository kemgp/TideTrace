import React from "react";
import { useNavigate } from "react-router-dom";
import TraceStatusBadge from "./TraceStatusBadge.jsx";

const THUMB_COLORS = { "Coral condition": "var(--tan)", Mangroves: "var(--teal)", Fisheries: "var(--blue)", Pollution: "var(--clay)", "Oral history": "var(--navy)", Other: "var(--soft)" };

export default function TraceCard({ trace, to }) {
  const navigate = useNavigate();
  return (
    <div className="tcard" onClick={() => to && navigate(to)}>
      <div className="thumb" style={{ background: THUMB_COLORS[trace.category] || "var(--bg)" }} />
      <div className="t">{trace.title}</div>
      <div className="m">
        <span>{trace.location} · {trace.when || trace.category}</span>
        <TraceStatusBadge status={trace.status} />
      </div>
    </div>
  );
}
