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
import TraceComments from "./TraceComments.jsx";
import "./trace-detail.css";

export default function LiveTraceDetail({ contribution = false }) {
  const { id } = useParams();
  const { profile } = useApp();
  const base = contribution ? "contributions" : "traces";
  const result = useRemoteData(`${base}/${encodeURIComponent(id)}`);

  return <div className={contribution ? "wrap" : "wrap trace-detail"} style={contribution ? { maxWidth: 760 } : undefined}>
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
    <Card className={contribution ? "" : "trace-detail__card"}>
      <div className="row between trace-detail__status">{!contribution && trace.status === "approved" ? <span className="badge approved">Approved · Published</span> : <TraceStatusBadge status={trace.status} />}<span className="hint">{trace.when}</span></div>
      {!contribution && <TracePhotos trace={current} hero />}
      <h2 className="trace-detail__title">{trace.title || "Untitled draft"}</h2>
      {fieldError("title")}
      <div className="chiprow trace-detail__tags"><span className="chip on">{trace.category}</span><span className="chip">{!contribution && <span aria-hidden="true">📍 </span>}{trace.location}</span></div>
      {fieldError("category_id")}
      {fieldError("location_name")}
      <div className="trace-detail__author">{!contribution && <span className="avatar trace-detail__avatar" aria-hidden="true" />}<p className="hint"><span>{trace.author}</span>{!contribution && trace.when && <> · {trace.when}</>}</p></div>
      <div className="divider" />
      <span className="lbl">Description</span>
      <p className="trace-detail__description">{trace.description || "No description supplied."}</p>
      {fieldError("description")}
      {!contribution && <TraceComments traceId={current.id} />}
      {contribution && trace.status === "pending" && <p role="status">Pending review. Your Trace is awaiting a reviewer; editing and uploads are disabled until a revision is requested.</p>}
      {contribution && current.status !== "draft" && <TraceFeedback key={`${current.id}:${current.status}`} id={current.id} />}
      {current.status === "revision_requested" && contribution && <p className="hint">Address the moderator's feedback, save your changes, then resubmit this Trace for review.</p>}
      {editable && !submissionLocked && <Link className="btn outline" to={`/user/contributions/${encodeURIComponent(trace.id)}/edit`}>{current.status === "revision_requested" ? "Edit requested revision" : "Edit draft"}</Link>}
      {fieldError("photo")}
      {contribution && <TracePhotos trace={current} contribution onChange={setCurrent} onLockedChange={setSubmissionLocked} onValidation={setFieldErrors} operationLock={operationLock} />}
    </Card>
  );
}
