import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext.jsx";
import TraceCard from "../../../components/TraceCard.jsx";
import Button from "../../../components/Button.jsx";

export default function ViewTraces() {
  const { traces, categories } = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("All");

  const filtered = useMemo(() => {
    return traces.filter((t) => {
      const matchesCat = cat === "All" || t.category === cat;
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
          <Button variant="clay" size="sm" onClick={() => navigate("/user/traces/upload")}>＋ Upload Trace</Button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search">
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#6b7f9e" strokeWidth={2}>
            <circle cx={11} cy={11} r={7} /><path d="m21 21-4-4" />
          </svg>
          <input placeholder="Search traces, people, places…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <div className="chiprow" style={{ marginBottom: 20 }}>
        <button className={`chip ${cat === "All" ? "on" : ""}`} onClick={() => setCat("All")}>All</button>
        {categories.map((c) => (
          <button key={c} className={`chip ${cat === c ? "on" : ""}`} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>

      {filtered.length > 0 ? (
        <div className="g3">
          {filtered.map((t) => <TraceCard key={t.id} trace={t} to={`/user/traces/${t.id}`} />)}
        </div>
      ) : (
        <div className="ph" style={{ marginTop: 10 }}>No traces match your filters.</div>
      )}
    </div>
  );
}
