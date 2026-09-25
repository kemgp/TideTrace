import React from "react";
import { Link } from "react-router-dom";

export default function TideCard({ tide }) {
  return <Link className="tcard" to={`/user/tides/${encodeURIComponent(tide.id)}`} style={{ display: "block", color: "inherit", textDecoration: "none" }}>
    <div className="thumb" style={{ background: "var(--teal)", height: 8 }} />
    <div className="t" style={{ overflowWrap: "anywhere" }}>{tide.title}</div>
    <div className="m"><span>Read lesson →</span></div>
  </Link>;
}
