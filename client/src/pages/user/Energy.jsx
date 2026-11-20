import React, { useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../../components/PageHeader.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import AdminIcon from "../../components/AdminIcon.jsx";
import { Pagination } from "../../components/RemoteState.jsx";
import useRemoteData from "../../hooks/useRemoteData.js";
import { shortDate } from "../../api/relativeTime.js";
import { PAGE_SIZE } from "../../api/pagination.js";
import "../../components/energy.css";

const FILTERS = [["all", "All"], ["trace", "Traces"], ["tide", "Tides"], ["quiz", "Quizzes"]];
const REWARDS = ["Eco store voucher", "Clean-up kit", "Seedling pack", "Community event pass"];
const KIND = {
  trace_approval: { label: "Trace approved", cls: "approved" },
  tide_completion: { label: "Tide completed", cls: "tide" },
  quiz_pass: { label: "Quiz passed", cls: "pending" },
};

// One ledger row. A reversal is its own negative row; the award it cancels shows "Reversed" and a struck-through amount.
function Row({ entry }) {
  const reversal = Boolean(entry.reverses_id);
  const kind = reversal ? { label: "Reversal", cls: "reversed" } : KIND[entry.award_type] || { label: "Energy", cls: "draft" };
  const amount = `${entry.amount < 0 ? "−" : "+"}${Math.abs(entry.amount)}`;
  const amountClass = reversal ? "is-negative" : entry.reversed ? "is-reversed" : "";
  return <li className="ledger-row">
    <div>
      <p className="t">{entry.title}</p>
      <p className="ledger-meta">
        <span className={`badge ${kind.cls}`}>{kind.label}</span>
        <span>{shortDate(entry.created_at)}</span>
        {!reversal && entry.reversed && <span className="badge reversed">Reversed</span>}
      </p>
      {reversal && <p className="ledger-reason">Reversed by an admin.{entry.reason ? ` ${entry.reason}` : ""}</p>}
      {!reversal && entry.source_deleted && <p className="ledger-reason">The Trace was deleted by its author. The award stays.</p>}
    </div>
    <span className={`ledger-amount ${amountClass}`.trim()}>{amount}</span>
  </li>;
}

export default function Energy() {
  const [kind, setKind] = useState("all");
  const [offset, setOffset] = useState(0);
  const query = `energy?limit=${PAGE_SIZE}&offset=${offset}${kind === "all" ? "" : `&kind=${kind}`}`;
  const result = useRemoteData(query, { object: true, keepPrevious: true });
  const data = result.data;
  const items = data?.items || [];
  const failed = Boolean(result.error) && !data;
  const loading = result.loading && !data;
  const empty = Boolean(data) && kind === "all" && offset === 0 && items.length === 0;
  const pick = (value) => { setKind(value); setOffset(0); };

  return <>
    <PageHeader
      as="h1"
      eyebrow="Tide Energy"
      title="Your energy"
      subtitle="Earned once from approved Traces, finished lessons and first quiz passes."
      actions={<Link className="btn clay" to="/user/traces/upload">New Trace</Link>}
    />
    <div className="page-body">
      <div className="energy-page">
        <div className="energy-grid">
          <section className="energy-card" aria-labelledby="balance-title">
            <div className="row"><span className="energy-tile"><AdminIcon name="bolt" size={24} /></span><h2 id="balance-title">Balance</h2></div>
            {loading && <span className="sk energy-balance-skeleton" role="status" aria-label="Loading balance" />}
            {failed && <p className="energy-figure"><span aria-hidden="true">–</span><span className="sr-only">Not available</span></p>}
            {data && <p className="energy-figure">{data.balance}</p>}
            <p className="hint">Personal and not transferable.</p>
            <div className="earn-list" role="group" aria-label="How you earn">
              <div><span>Trace approved (first time)</span><b>+20</b></div>
              <div><span>Tide completed</span><b>+5</b></div>
              <div><span>Quiz passed (first pass)</span><b>+15</b></div>
            </div>
          </section>
          <section className="card" aria-labelledby="rewards-title">
            <h2 id="rewards-title">Reward previews</h2>
            <p className="hint">Rewards are not available yet. Your energy is not spent.</p>
            <div className="reward-grid">
              {REWARDS.map((name) => <div className="reward-card" key={name}>
                <span className="reward-card__art" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" focusable="false"><path d="M20 12v9H4v-9" /><path d="M2 7h20v5H2z" /><path d="M12 22V7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></svg></span>
                <span className="t">{name}</span>
                <span className="reward-card__label">Preview: redemption unavailable</span>
                <button type="button" className="btn outline sm" disabled>Redeem</button>
              </div>)}
            </div>
          </section>
        </div>

        <section className="card" aria-labelledby="history-title">
          <div className="ledger-head">
            <h2 id="history-title">History</h2>
            <div className="energy-filters" role="group" aria-label="Filter history">
              {FILTERS.map(([value, label]) => <button key={value} type="button" className={`chip${kind === value ? " on" : ""}`} aria-pressed={kind === value} onClick={() => pick(value)}>{label}</button>)}
            </div>
          </div>
          {loading && <div className="energy-history-skeleton" role="status" aria-label="Loading energy history" aria-busy="true"><span className="sk" /><span className="sk" /><span className="sk" /></div>}
          {failed && <div style={{ marginTop: 12 }}><p role="alert">Could not load your energy history.</p><button type="button" className="btn outline sm" style={{ marginTop: 8 }} onClick={result.retry}>Try again</button></div>}
          {empty && <EmptyState title="No Tide Energy yet." hint="Finish a lesson, pass a quiz or have a Trace approved to start earning." action={{ to: "/user/tides", label: "Browse Tides" }} />}
          {data && !empty && items.length === 0 && <p className="hint" style={{ padding: "18px 4px" }}>{offset > 0 ? "No more entries." : "Nothing in this filter yet."}</p>}
          {items.length > 0 && <ul className="ledger-list" aria-busy={result.refreshing || undefined}>{items.map((entry) => <Row key={entry.id} entry={entry} />)}</ul>}
          {data && !empty && (offset > 0 || items.length >= PAGE_SIZE) && <Pagination offset={offset} count={items.length} size={PAGE_SIZE} onChange={setOffset} loading={Boolean(result.refreshing)} />}
        </section>
      </div>
    </div>
  </>;
}
