import { PAGE_SIZE } from "../../../api/pagination.js";
import React, { useEffect, useRef, useState } from "react";
import useRemoteData from "../../../hooks/useRemoteData.js";
import RemoteState, { Pagination } from "../../../components/RemoteState.jsx";
import Button from "../../../components/Button.jsx";
import TideCard from "../../../components/TideCard.jsx";
import TidesProgress from "../../../components/TidesProgress.jsx";
import PageHeader from "../../../components/PageHeader.jsx";
import "../../../components/TideFilters.css";

const PROGRESS = [["", "All lessons"], ["incomplete", "Incomplete"], ["completed", "Completed"]];

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
  // Where the member stopped in chaptered lessons they have not finished. A failed read just hides the extra detail.
  const saved = useRemoteData(lessons.length ? `tide-progress?tide_ids=${lessons.map((lesson) => encodeURIComponent(lesson.id)).join(",")}` : null, { collection: true });
  const stopped = new Map((saved.data || []).map((record) => [record.tide_id, record]));
  const statusOf = (tide) => {
    if (completions.loading) return "Loading completion…";
    if (completions.error) return "Completion unavailable";
    if (completed.has(tide.id)) return "Completed";
    const at = stopped.get(tide.id);
    return at ? `In progress, chapter ${at.part} of ${at.total}` : "Not started";
  };
  const filtered = Boolean(topic || progress || search);
  const choose = (setter) => (value) => { setter(value); setOffset(0); };
  const clear = () => { setTopic(""); setProgress(""); setTyped(""); setSearch(""); applied.current = ""; setOffset(0); };
  return <>
    <PageHeader eyebrow="Tides" title="Learn the sea in your own language" subtitle="Explore published lessons and learn about your coastal community."><TidesProgress /></PageHeader>
    <div className="page-body">
    <div className="tide-filters">
      <div className="toolbar">
        <div className="search">
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#6b7f9e" strokeWidth={2} aria-hidden="true">
            <circle cx={11} cy={11} r={7} /><path d="m21 21-4-4" />
          </svg>
          <input id="tide-search" aria-label="Search lessons" maxLength={80} placeholder="Search lessons…" value={typed} onChange={(event) => setTyped(event.target.value)} />
        </div>
        <div className="archive-view-switch" role="group" aria-label="Filter by progress">
          {PROGRESS.map(([value, label]) => <Button key={value || "all"} type="button" variant="ghost" size="sm" aria-pressed={progress === value} onClick={() => choose(setProgress)(value)}>{label}</Button>)}
        </div>
      </div>
      {topics.data?.length > 0 && <div className="chiprow archive-chips" role="group" aria-label="Filter by topic">
        <button type="button" className={`chip${!topic ? " on" : ""}`} aria-pressed={!topic} onClick={() => choose(setTopic)("")}>All topics</button>
        {topics.data.map((item) => <button type="button" key={item.id} className={`chip${topic === item.id ? " on" : ""}`} aria-pressed={topic === item.id} onClick={() => choose(setTopic)(item.id)}>{item.name}</button>)}
      </div>}
    </div>
    <RemoteState {...result} />
    {completions.error && <div><p>Completion status could not be loaded.</p><RemoteState {...completions} /></div>}
    {!result.loading && !result.error && (lessons.length
      ? <div className="g3 tide-results" aria-busy={result.refreshing}>{lessons.map((tide) => <TideCard key={tide.id} tide={tide} completionLabel={statusOf(tide)} />)}</div>
      : <div className="ph archive-empty tide-empty">{filtered ? <><p>No lessons match these filters. Try another search or clear filters.</p><Button type="button" variant="outline" size="sm" onClick={clear}>Clear filters</Button></> : "No published lessons found."}</div>)}
    <Pagination offset={offset} count={lessons.length} size={PAGE_SIZE} onChange={setOffset} loading={result.loading || Boolean(result.error)} />
    </div>
  </>;
}
