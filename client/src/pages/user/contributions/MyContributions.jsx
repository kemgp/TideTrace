import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import useRemoteData from "../../../hooks/useRemoteData.js";
import { displayTrace } from "../../../api/data.js";
import RemoteState, { Pagination } from "../../../components/RemoteState.jsx";
import TraceStatusBadge from "../../../components/TraceStatusBadge.jsx";
import Button from "../../../components/Button.jsx";

const FILTERS = ["All", "draft", "pending", "approved", "revision", "rejected"];
const FILTER_LABELS = { All: "All", draft: "Draft", pending: "Pending", approved: "Approved", revision: "Needs revision", rejected: "Rejected" };

export default function MyContributions() {
  const [offset, setOffset] = useState(0);
  const result = useRemoteData(`contributions?limit=25&offset=${offset}`, { collection: true });
  const navigate = useNavigate();
  const [filter, setFilter] = useState("All");

  const mine = (result.data || []).map(displayTrace);
  const filtered = filter === "All" ? mine : mine.filter((t) => t.status === filter);

  return (
    <div className="wrap">
      <div className="vhead">
        <div className="headrow">
          <div>
            <span className="eyebrow">My contributions</span>
            <h2>Your traces &amp; their status</h2>
            <p>Your saved submissions, including drafts. Status filters apply to the current page.</p>
          </div>
          <Button variant="clay" size="sm" onClick={() => navigate("/user/traces/upload")}>New Trace</Button>
        </div>
      </div>

      <div className="chiprow" style={{ marginBottom: 20 }}>
        {FILTERS.map((f) => (
          <button key={f} className={`chip ${filter === f ? "on" : ""}`} onClick={() => setFilter(f)}>{FILTER_LABELS[f]}</button>
        ))}
      </div>

      <RemoteState {...result} />
      {!result.loading && !result.error && (filtered.length > 0 ? (
        <div className="card">
          {filtered.map((t) => (
            <div className="lrow click" key={t.id} onClick={() => navigate(`/user/contributions/${t.id}`)}>
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
            </div>
          ))}
        </div>
      ) : (
        <div className="ph" style={{ marginTop: 10 }}>{filter === "All" ? "No saved contributions on this page." : "No contributions on this page match this status."}</div>
      ))}
      <Pagination offset={offset} count={mine.length} size={25} onChange={setOffset} loading={result.loading} />
    </div>
  );
}
