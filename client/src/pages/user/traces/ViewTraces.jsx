import { PAGE_SIZE } from "../../../api/pagination.js";
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import useRemoteData from "../../../hooks/useRemoteData.js";
import { displayTrace } from "../../../api/data.js";
import RemoteState, { Pagination } from "../../../components/RemoteState.jsx";
import TraceCard from "../../../components/TraceCard.jsx";
import CommunityMap from "../../../components/CommunityMap.jsx";
import Button from "../../../components/Button.jsx";

export default function ViewTraces() {
  const categoriesResult = useRemoteData("categories", { collection: true });
  const categories = categoriesResult.data || [];
  const [view, setView] = useState("list");
  const [offset, setOffset] = useState(0);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("All");
  const result = useRemoteData(`traces?limit=${PAGE_SIZE}&offset=${offset}${query.trim() ? `&q=${encodeURIComponent(query.trim())}` : ""}${cat === "All" ? "" : `&category_id=${encodeURIComponent(cat)}`}`, { collection: true });
  const traces = useMemo(() => (result.data || []).map(displayTrace), [result.data]);

  return (
    <div className="wrap community-archive">
      <div className="vhead">
        <div className="headrow">
          <div>
            <span className="eyebrow">Traces</span>
            <h2>Community archive</h2>
            <p>Sightings, clean-ups, and stories from coastal communities — searchable and filterable.</p>
          </div>
          <Button variant={view === "map" ? "outline" : "clay"} size="sm" onClick={() => navigate("/user/traces/upload")}>New Trace</Button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search">
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#6b7f9e" strokeWidth={2}>
            <circle cx={11} cy={11} r={7} /><path d="m21 21-4-4" />
          </svg>
          <input aria-label="Search traces" maxLength={200} placeholder="Search all traces, people, places…" value={query} onChange={(e) => { setQuery(e.target.value); setOffset(0); }} />
        </div>
        <div className="archive-view-switch" role="group" aria-label="Archive view">
          <Button type="button" variant="ghost" size="sm" aria-pressed={view === "list"} onClick={() => setView("list")}>List</Button>
          <Button type="button" variant="ghost" size="sm" aria-pressed={view === "map"} onClick={() => setView("map")}>Map</Button>
        </div>
      </div>

      <div className="chiprow" style={{ marginBottom: 20 }}>
        <button aria-pressed={cat === "All"} className={`chip ${cat === "All" ? "on" : ""}`} onClick={() => { setCat("All"); setOffset(0); }}>All</button>
        {categories.map((c) => (
          <button key={c.id} aria-pressed={cat === c.id} className={`chip ${cat === c.id ? "on" : ""}`} onClick={() => { setCat(c.id); setOffset(0); }}>{c.name}</button>
        ))}
      </div>

      <RemoteState compact {...categoriesResult} loading={categoriesResult.loading && !result.loading} />
      {view === "map" ? <CommunityMap query={query} category={cat} onList={() => setView("list")} /> : <>
      <RemoteState {...result} />
      {!result.loading && !result.error && (traces.length > 0 ? (
        <div className="g3">
          {traces.map((t) => <TraceCard key={t.id} trace={t} to={`/user/traces/${t.id}`} />)}
        </div>
      ) : (
        <div className="ph" style={{ marginTop: 10 }}>{query ? "No traces match your search." : "No approved traces found."}</div>
      ))}
      <Pagination offset={offset} count={traces.length} size={PAGE_SIZE} onChange={setOffset} loading={result.loading} />
      </>}
    </div>
  );
}
