import { PAGE_SIZE } from "../../../api/pagination.js";
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useRemoteData from "../../../hooks/useRemoteData.js";
import { displayTrace } from "../../../api/data.js";
import RemoteState, { Pagination } from "../../../components/RemoteState.jsx";
import TraceCategory from "../../../components/TraceCategory.jsx";
import TraceStatusBadge from "../../../components/TraceStatusBadge.jsx";
import Button from "../../../components/Button.jsx";

const FILTERS = ["All", "draft", "pending", "approved", "revision", "rejected"];
const FILTER_LABELS = { All: "All", draft: "Draft", pending: "Pending", approved: "Approved", revision: "Needs revision", rejected: "Rejected" };

export default function MyContributions() {
  const [offset, setOffset] = useState(0);
  const navigate = useNavigate();
  const [filter, setFilter] = useState("All");
  const status = filter === "revision" ? "revision_requested" : filter;
  const result = useRemoteData(`contributions?limit=${PAGE_SIZE}&offset=${offset}${filter === "All" ? "" : `&status=${status}`}`, { collection: true });

  const mine = (result.data || []).map(displayTrace);

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
        {FILTERS.map((f) => (
          <button key={f} className={`chip ${filter === f ? "on" : ""}`} aria-pressed={filter === f} onClick={() => { setFilter(f); setOffset(0); }}>{FILTER_LABELS[f]}</button>
        ))}
      </div>

      <RemoteState {...result} />
      {!result.loading && !result.error && (mine.length > 0 ? (
        <div className="user-contributions">
          {mine.map((t) => (
            <Link className="lrow user-contribution" key={t.id} to={`/user/contributions/${encodeURIComponent(t.id)}`}><TraceCategory category={t.category} />
              <div className="grow">
                <div className="t">{t.title}</div>
                <div className="m">
                  <span>{t.category}</span> · <span>{t.location}</span>
                </div>
                {t.status === "revision" && t.note && (
                  <div className="flag"><b>Feedback</b>{t.note}</div>
                )}
              </div>
              <TraceStatusBadge status={t.status} />
            </Link>
          ))}
        </div>
      ) : (
        <div className="ph" style={{ marginTop: 10 }}>{filter === "All" ? "No saved contributions on this page." : "No contributions match this status."}</div>
      ))}
      <Pagination offset={offset} count={mine.length} size={PAGE_SIZE} onChange={setOffset} loading={result.loading} />
    </div>
  );
}
