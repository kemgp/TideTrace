import React from "react";
import { Link, useParams } from "react-router-dom";
import useRemoteData from "../hooks/useRemoteData.js";
import { displayTrace } from "../api/data.js";
import RemoteState from "./RemoteState.jsx";
import TraceStatusBadge from "./TraceStatusBadge.jsx";
import Card from "./Card.jsx";

export default function LiveTraceDetail({ contribution = false }) {
  const { id } = useParams();
  const base = contribution ? "contributions" : "traces";
  const result = useRemoteData(`${base}/${encodeURIComponent(id)}`);
  const trace = result.data ? displayTrace(result.data) : null;
  return <div className="wrap" style={{ maxWidth: 760 }}>
    <Link className="btn ghost sm" style={{ marginBottom: 14 }} to={`/user/${base}`}>← Back to {contribution ? "My Contributions" : "Traces"}</Link>
    <RemoteState {...result} />
    {trace && <Card>
      <div className="row between" style={{ marginBottom: 12 }}><TraceStatusBadge status={trace.status} /><span className="hint">{trace.when}</span></div>
      <h2 style={{ fontSize: 19, margin: "16px 0 10px" }}>{trace.title || "Untitled draft"}</h2>
      <div className="chiprow" style={{ marginBottom: 14 }}><span className="chip on">{trace.category}</span><span className="chip">{trace.location}</span></div>
      <p className="hint">{trace.author}</p>
      <div className="divider" />
      <span className="lbl">Description</span>
      <p style={{ fontSize: "12.5px", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{trace.description || "No description supplied."}</p>
      <p className="hint">Media viewing{contribution ? " and submission editing" : " and comments"} will be available in a later update.</p>
    </Card>}
  </div>;
}
