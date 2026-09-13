import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext.jsx";
import TraceStatusBadge from "../../../components/TraceStatusBadge.jsx";
import Button from "../../../components/Button.jsx";

const FILTERS = ["All", "pending", "approved", "revision", "rejected"];
const FILTER_LABELS = { All: "All", pending: "Pending", approved: "Approved", revision: "Needs revision", rejected: "Rejected" };

export default function MyContributions() {
  const { traces } = useApp();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("All");

  const mine = traces.filter((t) => t.author === "Ana Ramos");
  const filtered = filter === "All" ? mine : mine.filter((t) => t.status === filter);

  return (
    <div className="wrap">
      <div className="vhead">
        <div className="headrow">
          <div>
            <span className="eyebrow">My contributions</span>
            <h2>Your traces &amp; their status</h2>
            <p>Status mirrors the moderator's latest decision — pending, approved, needs revision, or rejected.</p>
          </div>
          <Button variant="clay" size="sm" onClick={() => navigate("/user/traces/upload")}>＋ Upload Trace</Button>
        </div>
      </div>

      <div className="chiprow" style={{ marginBottom: 20 }}>
        {FILTERS.map((f) => (
          <button key={f} className={`chip ${filter === f ? "on" : ""}`} onClick={() => setFilter(f)}>{FILTER_LABELS[f]}</button>
        ))}
      </div>

      {filtered.length > 0 ? (
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
        <div className="ph" style={{ marginTop: 10 }}>Nothing here yet — upload your first trace.</div>
      )}
    </div>
  );
}
