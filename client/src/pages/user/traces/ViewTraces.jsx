import { PAGE_SIZE } from "../../../api/pagination.js";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { scrollToWhenReady } from "../../../components/ScrollManager.jsx";
import { readArchiveParams, writeArchiveParams, archiveSearch, pageToOffset, offsetToPage } from "../../../api/archiveParams.js";
import useRemoteData from "../../../hooks/useRemoteData.js";
import { displayTrace } from "../../../api/data.js";
import RemoteState, { Pagination } from "../../../components/RemoteState.jsx";
import TraceCard from "../../../components/TraceCard.jsx";
import CommunityMap from "../../../components/CommunityMap.jsx";
import Button from "../../../components/Button.jsx";

export default function ViewTraces() {
  const categoriesResult = useRemoteData("categories", { collection: true });
  const categories = categoriesResult.data || [];
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const restoreScroll = useRef(Boolean(location.state?.restoreScroll));
  const state = readArchiveParams(params);
  const { query, page, view } = state;
  const cat = categories.some((category) => category.id === state.category) ? state.category : "All";
  const offset = pageToOffset(page, PAGE_SIZE);
  const navigate = useNavigate();
  const [draft, setDraft] = useState(query);
  useEffect(() => setDraft(query), [params.toString()]);
  const update = (next, { replace = false } = {}) => {
    const merged = { ...state, ...next };
    if ((next.query !== undefined && next.query !== query) || (next.category !== undefined && next.category !== state.category)) merged.page = 1;
    setParams(writeArchiveParams(merged), { replace });
  };
  const result = useRemoteData(state.category !== "All" && categoriesResult.loading ? null : `traces?limit=${PAGE_SIZE}&offset=${offset}${query.trim() ? `&q=${encodeURIComponent(query.trim())}` : ""}${cat === "All" ? "" : `&category_id=${encodeURIComponent(cat)}`}`, { collection: true, keepPrevious: true });
  const traces = useMemo(() => (result.data || []).map(displayTrace), [result.data]);
  const filtering = Boolean(query.trim()) || cat !== "All";
  const scrollKey = `archive-scroll:${archiveSearch(state)}`;
  // Remember how far down the list the person was when they opened a trace, and return there after "Back to Traces".
  const rememberScroll = () => { try { sessionStorage.setItem(scrollKey, String((document.scrollingElement || document.documentElement).scrollTop || 0)); } catch { /* storage unavailable */ } };
  useEffect(() => {
    if (!restoreScroll.current || result.loading || !result.data) return;
    restoreScroll.current = false;
    let saved = 0;
    try { saved = Number(sessionStorage.getItem(scrollKey)) || 0; sessionStorage.removeItem(scrollKey); } catch { /* storage unavailable */ }
    if (saved > 0) scrollToWhenReady(saved);
  }, [result.loading, result.data, scrollKey]);
  const categoryName = categories.find((c) => c.id === cat)?.name;
  const clearFilters = () => { setDraft(""); update({ query: "", category: "All", page: 1 }); };
  const pickCategory = (value) => update({ category: categories.some((c) => c.id === value) ? value : "All" });
  useEffect(() => {
    if (result.data && !result.loading && !result.refreshing && !result.error && !result.data.length && page > 1) update({ page: 1 }, { replace: true });
  }, [result.data, result.loading, result.refreshing, result.error, page]);


  return (
    <div className="wrap community-archive">
      <div className="vhead">
        <div className="headrow">
          <div>
            <span className="eyebrow">Traces</span>
            <h2>Community archive</h2>
            <p>Sightings, clean-ups, and stories from coastal communities. Search and filter them.</p>
          </div>
          <Button variant="clay" size="sm" onClick={() => navigate("/user/traces/upload")}>New Trace</Button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search">
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#6b7f9e" strokeWidth={2}>
            <circle cx={11} cy={11} r={7} /><path d="m21 21-4-4" />
          </svg>
          <input aria-label="Search traces" maxLength={200} placeholder="Search all traces, people, places…" value={draft} onChange={(e) => { setDraft(e.target.value); update({ query: e.target.value }, { replace: true }); }} />
        </div>
        <div className="archive-view-switch" role="group" aria-label="Archive view">
          <Button type="button" variant="ghost" size="sm" aria-pressed={view === "list"} onClick={() => update({ view: "list" })}>List</Button>
          <Button type="button" variant="ghost" size="sm" aria-pressed={view === "map"} onClick={() => update({ view: "map" })}>Map</Button>
        </div>
      </div>

      <div className="archive-category-select">
        <label className="lbl" htmlFor="archive-category">Category</label>
        <select id="archive-category" className="input" value={cat} onChange={(e) => pickCategory(e.target.value)}>
          <option value="All">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="chiprow archive-chips" style={{ marginBottom: 20 }}>
        <button aria-pressed={cat === "All"} className={`chip ${cat === "All" ? "on" : ""}`} onClick={() => { pickCategory("All"); }}>All</button>
        {categories.map((c) => (
          <button key={c.id} aria-pressed={cat === c.id} className={`chip ${cat === c.id ? "on" : ""}`} onClick={() => { pickCategory(c.id); }}>{c.name}</button>
        ))}
      </div>

      <RemoteState compact {...categoriesResult} loading={categoriesResult.loading && !result.loading} />
      {view === "map" ? <CommunityMap query={query} category={cat} onList={() => update({ view: "list" })} /> : <>
      <RemoteState {...result} />
      {result.refreshing && <p className="sr-only" role="status">Updating traces…</p>}
      {!result.loading && !result.error && (traces.length > 0 ? (
        <>
        {filtering && <div className="archive-active">
          <p>Showing results{query.trim() && <> for “{query.trim()}”</>}{categoryName && <> in {categoryName}</>}</p>
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>Clear all filters</Button>
        </div>}
        <div className={`g3${result.refreshing ? " is-refreshing" : ""}`} aria-busy={result.refreshing || undefined} onClickCapture={rememberScroll}>
          {traces.map((t) => <TraceCard key={t.id} trace={t} to={`/user/traces/${t.id}`} linkState={{ archiveSearch: archiveSearch(state) }} />)}
        </div>
        </>
      ) : (
        <div className="ph archive-empty" style={{ marginTop: 10 }}>{filtering ? <>
          <p>No traces match these filters. Try another search or clear filters.</p>
          <Button type="button" variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
        </> : "No approved traces found."}</div>
      ))}
      {!(offset === 0 && !result.loading && !result.error && traces.length === 0) && <Pagination offset={offset} count={traces.length} size={PAGE_SIZE} onChange={(offset) => update({ page: offsetToPage(offset, PAGE_SIZE) })} loading={result.loading || result.refreshing} />}
      </>}
    </div>
  );
}
