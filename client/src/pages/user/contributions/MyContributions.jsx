import { PAGE_SIZE } from "../../../api/pagination.js";
import React, { useEffect, useRef } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import useRemoteData from "../../../hooks/useRemoteData.js";
import { displayTrace } from "../../../api/data.js";
import { CONTRIBUTION_FILTERS, contributionSearch, readContributionParams, writeContributionParams } from "../../../api/contributionParams.js";
import RemoteState, { Pagination } from "../../../components/RemoteState.jsx";
import TraceThumb from "../../../components/TraceThumb.jsx";
import TraceStatusBadge from "../../../components/TraceStatusBadge.jsx";
import RelativeTime from "../../../components/RelativeTime.jsx";
import EmptyState from "../../../components/EmptyState.jsx";
import { scrollToWhenReady } from "../../../components/ScrollManager.jsx";
import Button from "../../../components/Button.jsx";
import DeleteTrace from "../../../components/DeleteTrace.jsx";
import { useApp } from "../../../context/AppContext.jsx";
import "./contributions.css";

const FILTER_LABELS = { All: "All", draft: "Draft", pending: "Pending", approved: "Approved", revision: "Needs revision", rejected: "Rejected" };
// One line under each trace saying where it stands.
const STATUS_HINTS = { draft: "Not submitted yet", pending: "Waiting for a reviewer", approved: "Published", rejected: "Not published" };
const EMPTY_FILTERED = { draft: "No drafts.", pending: "Nothing is waiting for review.", approved: "No approved traces yet.", revision: "Nothing needs revision.", rejected: "No rejected traces." };

export default function MyContributions() {
  const [params, setParams] = useSearchParams();
  const { status: filter, page } = readContributionParams(params);
  const offset = (page - 1) * PAGE_SIZE;
  const update = (next, { replace = false } = {}) => setParams(writeContributionParams({ status: filter, page, ...next }), { replace });
  const navigate = useNavigate();
  const location = useLocation();
  const { writeData } = useApp();
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
    <div className="wrap">
      <div className="vhead">
        <div className="headrow">
          <div>
            <span className="eyebrow">My contributions</span>
            <h2>Your traces &amp; their status</h2>
            <p>Your saved submissions, including drafts. Filter by status across all your contributions.</p>
          </div>
          <Button variant="clay" size="sm" onClick={() => navigate("/user/traces/upload")}>New Trace</Button>
        </div>
      </div>

      <div className="chiprow" style={{ marginBottom: 20 }}>
        {CONTRIBUTION_FILTERS.map((f) => (
          <button key={f} className={`chip ${filter === f ? "on" : ""}`} aria-pressed={filter === f} onClick={() => update({ status: f, page: 1 })}>{FILTER_LABELS[f]}</button>
        ))}
      </div>

      <RemoteState {...result} />
      {!result.loading && !result.error && (mine.length > 0 ? (
        <div className="user-contributions" onClickCapture={rememberScroll}>
          {mine.map((t) => {
            // A draft has nothing to read yet, so its row opens the editor. Every other row opens the
            // trace page (a revision request shows the reviewer's feedback and the edit link there).
            const id = encodeURIComponent(t.id);
            const opensEditor = t.status === "draft" && !t.is_hidden && !t.deleted_at;
            return (
              <div className="row contrib-row" key={t.id}>
                <Link className="lrow user-contribution grow" to={`/user/contributions/${id}${opensEditor ? "/edit" : ""}`} state={{ listSearch: search }}>
                  <TraceThumb trace={t} />
                  <div className="grow">
                    <div className="t">{t.title}</div>
                    <div className="m">
                      <span>{t.category}</span> · <span>{t.location}</span>
                    </div>
                    <div className="m contrib-state">
                      {STATUS_HINTS[t.status] && <span>{STATUS_HINTS[t.status]}</span>}
                      {opensEditor && <><span aria-hidden="true">·</span><span className="contrib-next">Continue editing</span></>}
                      {STATUS_HINTS[t.status] && (t.updated_at || t.created_at) && <span aria-hidden="true">·</span>}
                      {(t.updated_at || t.created_at) && <span>Updated <RelativeTime value={t.updated_at || t.created_at} /></span>}
                    </div>
                    {t.status === "revision" && t.note && (
                      <div className="flag"><b>Feedback</b>{t.note}</div>
                    )}
                  </div>
                  <TraceStatusBadge status={t.status} />
                </Link>
                <div className="contrib-actions">
                  <DeleteTrace trace={t} quiet onDeleted={result.retry} />
                </div>
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
  );
}
