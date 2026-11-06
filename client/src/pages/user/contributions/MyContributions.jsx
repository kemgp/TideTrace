import { PAGE_SIZE } from "../../../api/pagination.js";
import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import useDashboard from "../../../hooks/useDashboard.js";
import useRemoteData from "../../../hooks/useRemoteData.js";
import { displayTrace } from "../../../api/data.js";
import { CONTRIBUTION_FILTERS, contributionSearch, readContributionParams, writeContributionParams } from "../../../api/contributionParams.js";
import RemoteState, { Pagination } from "../../../components/RemoteState.jsx";
import TraceThumb from "../../../components/TraceThumb.jsx";
import TraceStatusBadge from "../../../components/TraceStatusBadge.jsx";
import RelativeTime from "../../../components/RelativeTime.jsx";
import EmptyState from "../../../components/EmptyState.jsx";
import { scrollToWhenReady } from "../../../components/ScrollManager.jsx";
import PageHeader from "../../../components/PageHeader.jsx";
import DeleteTrace from "../../../components/DeleteTrace.jsx";
import RowMenu from "../../../components/RowMenu.jsx";
import { useApp } from "../../../context/AppContext.jsx";
import "./contributions.css";

const FILTER_LABELS = { All: "All", draft: "Draft", pending: "Pending", approved: "Approved", revision: "Needs revision", rejected: "Rejected", removed: "Removed" };
// One line under each trace saying where it stands.
const STATUS_HINTS = { draft: "Not submitted yet", pending: "Waiting for a reviewer", approved: "Published", rejected: "Not published", removed: "Removed by a moderator. It is no longer public." };
// Which dashboard total backs each filter chip. "Rejected" has a count only when the totals report it.
const COUNT_KEYS = { All: "traces", draft: "drafts", pending: "pending", approved: "approved", revision: "needs_revision", rejected: "rejected", removed: "removed" };
const EMPTY_FILTERED = { draft: "No drafts.", pending: "Nothing is waiting for review.", approved: "No approved traces yet.", revision: "Nothing needs revision.", rejected: "No rejected traces.", removed: "No removed traces." };

export default function MyContributions() {
  const [params, setParams] = useSearchParams();
  const { status: filter, page } = readContributionParams(params);
  const offset = (page - 1) * PAGE_SIZE;
  const update = (next, { replace = false } = {}) => setParams(writeContributionParams({ status: filter, page, ...next }), { replace });
  const location = useLocation();
  const { writeData } = useApp();
  const totals = useDashboard();
  const countOf = (name) => Number.isSafeInteger(totals.data?.[COUNT_KEYS[name]]) ? totals.data[COUNT_KEYS[name]] : null;
  // The row whose delete confirmation is open (from its "⋯" menu).
  const [deleting, setDeleting] = useState(null);
  const swept = useRef(false);
  // Quietly finish any photo removal that an earlier delete could not complete. Failures are
  // ignored here; the next visit tries again.
  useEffect(() => {
    if (swept.current) return;
    swept.current = true;
    Promise.resolve(writeData?.("contributions/photo-cleanup", { method: "POST" })).catch(() => {});
  }, [writeData]);
  const status = filter === "revision" ? "revision_requested" : filter;
  const result = useRemoteData(`contributions?limit=${PAGE_SIZE}&offset=${offset}${filter === "All" ? "" : `&status=${status}`}`, { collection: true });
  const mine = (result.data || []).map(displayTrace);
  const search = contributionSearch({ status: filter, page });

  // Returning from a trace puts the list back where it was.
  const restoreScroll = useRef(Boolean(location.state?.restoreScroll));
  const scrollKey = `contributions-scroll:${search}`;
  const rememberScroll = () => { try { sessionStorage.setItem(scrollKey, String((document.scrollingElement || document.documentElement).scrollTop || 0)); } catch { /* storage unavailable */ } };
  useEffect(() => {
    if (!restoreScroll.current || result.loading || !result.data) return;
    restoreScroll.current = false;
    let saved = 0;
    try { saved = Number(sessionStorage.getItem(scrollKey)) || 0; sessionStorage.removeItem(scrollKey); } catch { /* storage unavailable */ }
    if (saved > 0) scrollToWhenReady(saved);
  }, [result.loading, result.data, scrollKey]);
  // A page past the end (for example after deleting the last row of it) goes back to page 1.
  useEffect(() => {
    if (result.data && !result.loading && !result.error && !result.data.length && page > 1) update({ page: 1 }, { replace: true });
  }, [result.data, result.loading, result.error, page]);

  return (
    <>
    <PageHeader eyebrow="My contributions" title="Your traces &amp; their status" subtitle="Your saved submissions, including drafts. Filter by status across all your contributions." actions={<Link className="banner-action" to="/user/traces/upload">New Trace</Link>} />
    <div className="page-body contributions-page">
      <div className="chiprow contrib-filters">
        {CONTRIBUTION_FILTERS.map((f) => (
          <button key={f} className={`chip ${filter === f ? "on" : ""}`} aria-pressed={filter === f} onClick={() => update({ status: f, page: 1 })}>{FILTER_LABELS[f]}{countOf(f) !== null && <>{" "}<span className="chip-count">{countOf(f)}</span></>}</button>
        ))}
      </div>

      <RemoteState {...result} />
      {!result.loading && !result.error && (mine.length > 0 ? (
        <div className="user-contributions" onClickCapture={rememberScroll}>
          {mine.map((t) => {
            // One primary action per row, and it is the row's only link (its box is stretched over the card).
            // Drafts and revision requests open the editor; everything else opens the trace page.
            const id = encodeURIComponent(t.id);
            const editable = !t.is_hidden && !t.deleted_at;
            const primary = t.status === "draft" && editable ? { label: "Continue editing", to: `/user/contributions/${id}/edit`, variant: "blue" }
              : t.status === "revision" && editable ? { label: "Revise", to: `/user/contributions/${id}/edit`, variant: "blue" }
              : { label: "View", to: `/user/contributions/${id}`, variant: "outline" };
            const state = t.is_hidden ? "removed" : t.status;
            const note = (t.reviewer_note || t.note || "").trim();
            return (
              <div className="contrib-row" key={t.id}>
                <TraceThumb trace={t} />
                <div className="contrib-text">
                  <div className="t">{t.title}</div>
                  <div className="m">
                    <span>{t.category}</span> · <span>{t.location}</span>
                  </div>
                  <div className="m contrib-state">
                    {STATUS_HINTS[state] && <span>{STATUS_HINTS[state]}</span>}
                    {STATUS_HINTS[state] && (t.updated_at || t.created_at) && <span aria-hidden="true">·</span>}
                    {(t.updated_at || t.created_at) && <span>Updated <RelativeTime value={t.updated_at || t.created_at} /></span>}
                  </div>
                  {t.status === "revision" && note && (
                    <div className="flag"><b>Feedback</b>{note}</div>
                  )}
                </div>
                <TraceStatusBadge status={state} />
                <div className="contrib-actions">
                  <Link className={`btn ${primary.variant} sm contrib-primary`} to={primary.to} state={{ listSearch: search }} aria-label={`${primary.label}: ${t.title}`}>{primary.label}</Link>
                  <RowMenu label={`More actions for ${t.title}`} items={[{ label: "Delete", danger: true, onSelect: () => setDeleting(t.id) }]} />
                </div>
                <DeleteTrace trace={t} open={deleting === t.id} onOpenChange={(next) => setDeleting(next ? t.id : null)} onDeleted={() => { result.retry(); totals.refresh(); }} />
              </div>
            );
          })}
        </div>
      ) : filter === "All" ? (
        <EmptyState title="You haven't submitted any traces yet." hint="Share something you have seen along the coast." action={{ to: "/user/traces/upload", label: "Upload your first trace" }} />
      ) : (
        <EmptyState title={EMPTY_FILTERED[filter]} hint="Try another status." action={{ to: "/user/contributions", label: "Show all traces" }} />
      ))}
      <Pagination offset={offset} count={mine.length} size={PAGE_SIZE} onChange={(next) => update({ page: Math.floor(next / PAGE_SIZE) + 1 })} loading={result.loading} />
    </div>
    </>
  );
}
