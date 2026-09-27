import ContentTabs from "./ContentTabs.jsx";
import AdminIcon from "../../components/AdminIcon.jsx";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import useRemoteData from "../../hooks/useRemoteData.js";
import RemoteState, { Pagination } from "../../components/RemoteState.jsx";

export default function ManageTides() {
  const [offset, setOffset] = useState(0);
  const result = useRemoteData(`admin/tides?limit=25&offset=${offset}`, { collection: true });
  const lessons = result.data || [];
  return <div className="wrap">
    <div className="vhead headrow"><div><span className="eyebrow claye">Manage content — Tides</span><h2>Topics &amp; lessons</h2><p>Tides are TideTrace’s educational content — lessons about local ecosystems, biodiversity, pollution, and conservation.</p></div><Link className="btn blue" to="/admin/tides/new">＋ Add lesson</Link></div>
    <ContentTabs />
    <button className="btn outline sm" disabled={result.loading} onClick={result.retry}>Refresh lessons</button>
    <RemoteState {...result} />
    {!result.loading && !result.error && (lessons.length ? <div className="card" style={{ marginTop: 16 }}>{lessons.map((lesson, index) => <div className="lrow" key={lesson.id}>
      <span className="admin-lesson-icon" style={{ background: ["var(--teal)", "var(--navy)", "var(--clay)", "var(--tan)"][index % 4] }}><AdminIcon name="book" size={22} /></span>
      <div className="grow"><Link className="t" to={`/admin/tides/${encodeURIComponent(lesson.id)}/edit`}>{lesson.title}</Link><div className="hint" style={{ overflowWrap: "anywhere" }}>{lesson.slug}</div></div>
      <span className={`badge ${lesson.status === "published" ? "approved" : "draft"}`}>{lesson.status === "published" ? "Published" : lesson.status === "archived" ? "Archived" : "Draft"}</span>
      <Link className="mini blue" to={`/admin/tides/${encodeURIComponent(lesson.id)}/edit`}>Edit</Link>
    </div>)}</div> : <p>No lessons yet. Add your first lesson to get started.</p>)}
    <Pagination offset={offset} count={lessons.length} size={25} onChange={setOffset} loading={result.loading || Boolean(result.error)} />
  </div>;
}
