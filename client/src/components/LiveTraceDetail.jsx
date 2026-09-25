import React, { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import useRemoteData from "../hooks/useRemoteData.js";
import { displayTrace } from "../api/data.js";
import RemoteState from "./RemoteState.jsx";
import TraceStatusBadge from "./TraceStatusBadge.jsx";
import TracePhotos from "./TracePhotos.jsx";
import { useApp } from "../context/AppContext.jsx";
import TraceFeedback from "./TraceFeedback.jsx";
import Card from "./Card.jsx";

export default function LiveTraceDetail({ contribution = false }) {
  const { id } = useParams();
  const { profile } = useApp();
  const base = contribution ? "contributions" : "traces";
  const result = useRemoteData(`${base}/${encodeURIComponent(id)}`);

  return <div className="wrap" style={{ maxWidth: 760 }}>
    <Link className="btn ghost sm" style={{ marginBottom: 14 }} to={`/user/${base}`}>← Back to {contribution ? "My Contributions" : "Traces"}</Link>
    <RemoteState {...result} />
    {result.data && <TraceContent key={`${profile?.id}:${result.data.id}`} initialTrace={result.data} contribution={contribution} />}
  </div>;
}

function TraceContent({ initialTrace, contribution }) {
  const { profile } = useApp();
  const [current, setCurrent] = useState(initialTrace);
  const [fieldErrors, setFieldErrors] = useState({});
  const fieldError = (name) => fieldErrors[name] ? <p role="alert" style={{ color: "var(--clay)" }}>{fieldErrors[name]}</p> : null;
  const [submissionLocked, setSubmissionLocked] = useState(false);
  const operationLock = useRef(null);
  const trace = displayTrace(current);
  const editable = contribution && current.author_id === profile?.id && ["draft", "revision_requested"].includes(current.status) && !current.is_hidden && !current.deleted_at;
  return (
    <Card>
      <div className="row between" style={{ marginBottom: 12 }}><TraceStatusBadge status={trace.status} /><span className="hint">{trace.when}</span></div>
      <h2 style={{ fontSize: 19, margin: "16px 0 10px" }}>{trace.title || "Untitled draft"}</h2>
      {fieldError("title")}
      <div className="chiprow" style={{ marginBottom: 14 }}><span className="chip on">{trace.category}</span><span className="chip">{trace.location}</span></div>
      {fieldError("category_id")}
      {fieldError("location_name")}
      <p className="hint">{trace.author}</p>
      <div className="divider" />
      <span className="lbl">Description</span>
      <p style={{ fontSize: "12.5px", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{trace.description || "No description supplied."}</p>
      {fieldError("description")}
      {!contribution && <p className="hint">Comments will be available in a later update.</p>}
      {contribution && trace.status === "pending" && <p role="status">Pending review. Your Trace is awaiting a reviewer; editing and uploads are disabled until a revision is requested.</p>}
      {contribution && current.status !== "draft" && <TraceFeedback key={`${current.id}:${current.status}`} id={current.id} />}
      {current.status === "revision_requested" && contribution && <p className="hint">Address the moderator's feedback, save your changes, then resubmit this Trace for review.</p>}
      {editable && !submissionLocked && <Link className="btn outline" to={`/user/contributions/${encodeURIComponent(trace.id)}/edit`}>{current.status === "revision_requested" ? "Edit requested revision" : "Edit draft"}</Link>}
      {fieldError("photo")}
      <TracePhotos trace={current} contribution={contribution} onChange={setCurrent} onLockedChange={setSubmissionLocked} onValidation={setFieldErrors} operationLock={operationLock} />
    </Card>
  );
}
