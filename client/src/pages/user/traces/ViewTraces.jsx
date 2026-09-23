import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import useRemoteData from "../../../hooks/useRemoteData.js";
import { displayTrace } from "../../../api/data.js";
import RemoteState, { Pagination } from "../../../components/RemoteState.jsx";
import TraceCard from "../../../components/TraceCard.jsx";
import Button from "../../../components/Button.jsx";

export default function ViewTraces() {
  const categoriesResult = useRemoteData("categories", { collection: true });
  const categories = categoriesResult.data || [];
  const [offset, setOffset] = useState(0);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("All");
  const result = useRemoteData(`traces?limit=25&offset=${offset}${cat === "All" ? "" : `&category_id=${encodeURIComponent(cat)}`}`, { collection: true });
  const traces = useMemo(() => (result.data || []).map(displayTrace), [result.data]);

  const filtered = useMemo(() => {
    return traces.filter((t) => {
      const matchesCat = cat === "All" || t.category_id === cat;
      const matchesQuery =
        !query ||
        t.title.toLowerCase().includes(query.toLowerCase()) ||
        t.author.toLowerCase().includes(query.toLowerCase()) ||
        t.location.toLowerCase().includes(query.toLowerCase());
      return matchesCat && matchesQuery;
    });
  }, [traces, query, cat]);

  return (
    <div className="wrap">
      <div className="vhead">
        <div className="headrow">
          <div>
            <span className="eyebrow">Traces</span>
            <h2>Community archive</h2>
            <p>Sightings, clean-ups, and stories from coastal communities — searchable and filterable.</p>
          </div>
          <Button variant="clay" size="sm" onClick={() => navigate("/user/traces/upload")}>Preview submission form (demo)</Button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search">
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#6b7f9e" strokeWidth={2}>
            <circle cx={11} cy={11} r={7} /><path d="m21 21-4-4" />
          </svg>
          <input placeholder="Search this page: traces, people, places…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <div className="chiprow" style={{ marginBottom: 20 }}>
        <button className={`chip ${cat === "All" ? "on" : ""}`} onClick={() => { setCat("All"); setOffset(0); }}>All</button>
        {categories.map((c) => (
          <button key={c.id} className={`chip ${cat === c.id ? "on" : ""}`} onClick={() => { setCat(c.id); setOffset(0); }}>{c.name}</button>
        ))}
      </div>

      <RemoteState {...categoriesResult} />
      <RemoteState {...result} />
      {!result.loading && !result.error && (filtered.length > 0 ? (
        <div className="g3">
          {filtered.map((t) => <TraceCard key={t.id} trace={t} to={`/user/traces/${t.id}`} />)}
        </div>
      ) : (
        <div className="ph" style={{ marginTop: 10 }}>{query ? "No traces on this page match your search." : "No approved traces found."}</div>
      ))}
      <Pagination offset={offset} count={traces.length} size={25} onChange={setOffset} loading={result.loading} />
    </div>
  );
}
