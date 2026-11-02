import React from "react";
import { Link } from "react-router-dom";
import useRemoteData from "../hooks/useRemoteData.js";

export default function TraceNeighbors({ traceId, archiveSearch }) {
  const { data, loading, error } = useRemoteData(`traces/${encodeURIComponent(traceId)}/neighbors`, { object: true });
  if (loading || error || (!data?.newer && !data?.older)) return null;
  return <nav className="trace-neighbors" aria-label="More traces">
    {["newer", "older"].map((direction) => data[direction] && <Link key={direction} className={`trace-neighbors__link trace-neighbors__link--${direction}`}
      to={`/user/traces/${data[direction].id}`} state={{ archiveSearch }}>
      <small>{direction === "newer" ? "Newer trace" : "Older trace"}</small>{" "}
      <span title={data[direction].title}>{data[direction].title}</span>
    </Link>)}
  </nav>;
}
