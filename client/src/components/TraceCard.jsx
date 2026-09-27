import React from "react";
import { Link } from "react-router-dom";
import TraceStatusBadge from "./TraceStatusBadge.jsx";
import { traceColor } from "./TraceCategory.jsx";
import AdminIcon from "./AdminIcon.jsx";

export default function TraceCard({ trace, to }) {
  const Tag = to ? Link : "article";
  return <Tag className="tcard user-trace-card" {...(to ? { to } : {})}>
    <div className="thumb" aria-hidden="true" style={{ background: traceColor(trace.category) }} />
    <div className="t">{trace.title}</div>
    <div className="m"><span>{trace.author}{trace.when && ` · ${trace.when}`}</span><span className="user-category-label">{trace.category}</span></div>
    <div className="m"><span className="user-card-location"><AdminIcon name="pin" size={13} />{trace.location}</span>{trace.status !== "approved" && <TraceStatusBadge status={trace.status} />}</div>
  </Tag>;
}
