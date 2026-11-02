import { PAGE_SIZE } from "../../../api/pagination.js";
import React, { useEffect, useRef, useState } from "react";
import useRemoteData from "../../../hooks/useRemoteData.js";
import RemoteState, { Pagination } from "../../../components/RemoteState.jsx";
import TideCard from "../../../components/TideCard.jsx";
import TidesProgress from "../../../components/TidesProgress.jsx";
import "../../../components/TideFilters.css";

const PROGRESS = [["", "All lessons"], ["not_started", "Not started"], ["completed", "Completed"]];

export default function Tides() {
  const [offset, setOffset] = useState(0);
  const [topic, setTopic] = useState("");
  const [progress, setProgress] = useState("");
  const [typed, setTyped] = useState("");
  const [search, setSearch] = useState("");
  const applied = useRef("");
  // Wait for a short pause in typing before asking the server.
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = typed.trim();
      if (next === applied.current) return;
      applied.current = next; setSearch(next); setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [typed]);
  const topics = useRemoteData("categories", { collection: true });
  const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
  if (topic) params.set("category_id", topic);
  if (progress) params.set("progress", progress);
  if (search) params.set("q", search);
  const result = useRemoteData(`tides?${params}`, { collection: true, keepPrevious: true });
  const lessons = result.data || [];
  const completions = useRemoteData(lessons.length ? `tide-completions?tide_ids=${lessons.map((lesson) => encodeURIComponent(lesson.id)).join(",")}` : null, { collection: true });
  const completed = new Set((completions.data || []).map((record) => record.tide_id));
  const filtered = Boolean(topic || progress || search);
  const choose = (setter) => (value) => { setter(value); setOffset(0); };
  const clear = () => { setTopic(""); setProgress(""); setTyped(""); setSearch(""); applied.current = ""; setOffset(0); };
  return <div className="wrap">
    <div className="vhead"><span className="eyebrow">Tides</span><h2>Learn the sea in your own language</h2><p>Explore published lessons and learn about your coastal community.</p></div>
    <TidesProgress />
    <div className="tide-filters">
      <div className="tide-filter-bar">
        <div className="tide-search">
          <label className="sr-only" htmlFor="tide-search">Search lessons</label>
          <input id="tide-search" type="search" className="input" placeholder="Search lessons" maxLength={80} value={typed} onChange={(event) => setTyped(event.target.value)} />
        </div>
        <div className="tide-chips tide-segment" role="group" aria-label="Filter by progress">
          {PROGRESS.map(([value, label]) => <button type="button" key={value || "all"} className="tide-chip" aria-pressed={progress === value} onClick={() => choose(setProgress)(value)}>{label}</button>)}
        </div>
      </div>
      {topics.data?.length > 0 && <div className="tide-chips tide-topics" role="group" aria-label="Filter by topic">
        <button type="button" className="tide-chip" aria-pressed={!topic} onClick={() => choose(setTopic)("")}>All topics</button>
        {topics.data.map((item) => <button type="button" key={item.id} className="tide-chip" aria-pressed={topic === item.id} onClick={() => choose(setTopic)(item.id)}>{item.name}</button>)}
      </div>}
    </div>
    <RemoteState {...result} />
    {completions.error && <div><p>Completion status could not be loaded.</p><RemoteState {...completions} /></div>}
    {!result.loading && !result.error && (lessons.length
      ? <div className="g3 tide-results" aria-busy={result.refreshing}>{lessons.map((tide) => <TideCard key={tide.id} tide={tide} completionLabel={progress ? (progress === "completed" ? "Completed" : "Not started") : completions.loading ? "Loading completion…" : completions.error ? "Completion unavailable" : completed.has(tide.id) ? "Completed" : "Not started"} />)}</div>
      : <div className="tide-empty"><p>{filtered ? "No lessons match these filters." : "No published lessons found."}</p>{filtered && <button type="button" className="btn outline sm" onClick={clear}>Clear filters</button>}</div>)}
    <Pagination offset={offset} count={lessons.length} size={PAGE_SIZE} onChange={setOffset} loading={result.loading || Boolean(result.error)} />
  </div>;
}
