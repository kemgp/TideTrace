import React, { useState } from "react";
import { Link } from "react-router-dom";
import useRemoteData from "../../hooks/useRemoteData.js";
import RemoteState, { Pagination } from "../../components/RemoteState.jsx";

export default function ManageTides() {
  const [offset, setOffset] = useState(0);
  const result = useRemoteData(`admin/tides?limit=25&offset=${offset}`, { collection: true });
  const lessons = result.data || [];
  return <div className="wrap">
    <div className="vhead headrow"><div><span className="eyebrow claye">Manage Tides</span><h2>Topics &amp; lessons</h2><p>Create, edit, publish or archive educational content.</p></div><Link className="btn blue" to="/admin/tides/new">Add lesson</Link></div>
    <button className="btn outline sm" disabled={result.loading} onClick={result.retry}>Refresh lessons</button>
    <RemoteState {...result} />
    {!result.loading && !result.error && (lessons.length ? <div className="card" style={{ marginTop: 16 }}>{lessons.map((lesson) => <div className="lrow" key={lesson.id}>
      <div className="grow"><Link className="t" to={`/admin/tides/${encodeURIComponent(lesson.id)}/edit`}>{lesson.title}</Link><div className="hint" style={{ overflowWrap: "anywhere" }}>{lesson.slug}</div></div>
      <span className={`badge ${lesson.status === "published" ? "approved" : "draft"}`}>{lesson.status === "published" ? "Published" : lesson.status === "archived" ? "Archived" : "Draft"}</span>
    </div>)}</div> : <p>No lessons yet. Add your first lesson to get started.</p>)}
    <Pagination offset={offset} count={lessons.length} size={25} onChange={setOffset} loading={result.loading || Boolean(result.error)} />
  </div>;
}
