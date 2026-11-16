import React, { useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../../components/PageHeader.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { Pagination } from "../../components/RemoteState.jsx";
import { InsightsSwitch } from "../../components/StaffSwitches.jsx";
import useRemoteData from "../../hooks/useRemoteData.js";
import { shortDate } from "../../api/relativeTime.js";
import { PAGE_SIZE } from "../../api/pagination.js";
import "../../components/energy.css";

const FILTERS = [["all", "All"], ["trace", "Traces"], ["tide", "Tides"], ["quiz", "Quizzes"]];
export const AWARD_LABEL = { trace_approval: "Trace award", tide_completion: "Tide award", quiz_pass: "Quiz award" };
const STATS = [["open_flags", "Open flags"], ["awards", "Awards issued"], ["energy_issued", "Energy issued"], ["reversals", "Reversals"]];

function Stat({ field, label, totals, loading }) {
  const value = totals?.[field];
  return <div className="stat">
    <b>{loading ? <span className="stat-placeholder" role="status" aria-label={`Loading ${label}`} /> : Number.isSafeInteger(value) ? value : <><span aria-hidden="true">–</span><span className="sr-only">Not available</span></>}</b>
    <span>{label}</span>
  </div>;
}

function AwardRow({ entry }) {
  const reversed = Boolean(entry.reversed);
  return <li>
    <Link className="ledger-row energy-admin-row" to={`/admin/energy/awards/${entry.id}`} aria-label={`Open award: ${entry.title} for ${entry.owner_name}`}>
      <div>
        <p className="t">{entry.title}</p>
        <p className="ledger-meta">
          <span className="badge draft">{AWARD_LABEL[entry.award_type] || "Award"}</span>
          <span>{entry.owner_name}</span>
          <span>{shortDate(entry.created_at)}</span>
          <span className={`badge ${reversed ? "reversed" : "approved"}`}>{reversed ? "Reversed" : "Awarded"}</span>
          {entry.open_flag && <span className="badge open">Flag open</span>}
        </p>
      </div>
      <span className={`ledger-amount ${reversed ? "is-reversed" : ""}`.trim()}>+{entry.amount}</span>
    </Link>
  </li>;
}

export default function EnergyActivity() {
  const [kind, setKind] = useState("all");
  const [offset, setOffset] = useState(0);
  const query = `admin/energy/activity?limit=${PAGE_SIZE}&offset=${offset}${kind === "all" ? "" : `&kind=${kind}`}`;
  const result = useRemoteData(query, { object: true, keepPrevious: true });
  const data = result.data;
  const awards = data?.awards || [];
  const flags = data?.open_flags || [];
  const loading = result.loading && !data;
  const failed = Boolean(result.error) && !data;
  const pick = (value) => { setKind(value); setOffset(0); };

  return <>
    <PageHeader
      as="h1"
      eyebrow="View analytics"
      title="Energy activity"
      subtitle="Awards, open flags and reversals. Each source earns once."
    >
      <InsightsSwitch />
    </PageHeader>
    <div className="page-body">
      <div className="energy-page">
        {failed && <div><p role="alert">Could not load energy activity.</p><button type="button" className="btn outline sm" style={{ marginTop: 8 }} onClick={result.retry}>Try again</button></div>}
        {data && data.active === false && <p className="notice is-warn" role="status">Tide Energy is not active yet. Activate it in Settings before awards are issued.</p>}
        <div className="g4" role="group" aria-label="Energy totals">
          {STATS.map(([field, label]) => <Stat key={field} field={field} label={label} totals={data?.totals} loading={loading} />)}
        </div>

        <section className="card" aria-labelledby="open-flags-title">
          <h2 id="open-flags-title">Open flags</h2>
          {loading && <div className="energy-history-skeleton" role="status" aria-label="Loading open flags" aria-busy="true"><span className="sk" /><span className="sk" /></div>}
          {data && flags.length === 0 && <p className="hint" style={{ padding: "12px 4px" }}>No open flags.</p>}
          {flags.length > 0 && <ul className="ledger-list">{flags.map((flag) => <li key={flag.id}>
            <Link className="ledger-row energy-admin-row" to={`/admin/energy/awards/${flag.ledger_id}`} aria-label={`Review flag: ${flag.title}`}>
              <div>
                <p className="t">{flag.title}</p>
                <p className="ledger-meta"><span>Award flagged by {flag.flagged_by_name}</span><span>{shortDate(flag.created_at)}</span><span className="badge open">Open</span></p>
              </div>
              <span className="ledger-amount">+{flag.amount}</span>
            </Link>
          </li>)}</ul>}
        </section>

        <section className="card" aria-labelledby="recent-awards-title">
          <div className="ledger-head">
            <h2 id="recent-awards-title">Recent awards</h2>
            <div className="energy-filters" role="group" aria-label="Filter awards">
              {FILTERS.map(([value, label]) => <button key={value} type="button" className={`chip${kind === value ? " on" : ""}`} aria-pressed={kind === value} onClick={() => pick(value)}>{label}</button>)}
            </div>
          </div>
          {loading && <div className="energy-history-skeleton" role="status" aria-label="Loading awards" aria-busy="true"><span className="sk" /><span className="sk" /><span className="sk" /></div>}
          {data && awards.length === 0 && (kind === "all" && offset === 0
            ? <EmptyState title="No awards yet." hint="Awards appear here once members earn Tide Energy." />
            : <p className="hint" style={{ padding: "18px 4px" }}>{offset > 0 ? "No more awards." : "Nothing in this filter yet."}</p>)}
          {awards.length > 0 && <ul className="ledger-list" aria-busy={result.refreshing || undefined}>{awards.map((entry) => <AwardRow key={entry.id} entry={entry} />)}</ul>}
          {data && (offset > 0 || awards.length >= PAGE_SIZE) && <Pagination offset={offset} count={awards.length} size={PAGE_SIZE} onChange={setOffset} loading={Boolean(result.refreshing)} />}
        </section>
      </div>
    </div>
  </>;
}
