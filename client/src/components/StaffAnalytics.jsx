import React from "react";
import { useApp } from "../context/AppContext.jsx";
import useRemoteData from "../hooks/useRemoteData.js";
import RemoteState from "./RemoteState.jsx";

function Bars({ title, rows }) {
  const max = Math.max(1, ...rows.map(row => row.value));
  return <section className="card admin-chart"><h3 className="lbl">{title}</h3>{rows.map(row => <div className="admin-bar-row" key={row.id || row.label}><span>{row.label}</span><div className="admin-bar-track" aria-hidden="true"><div style={{ width: `${row.value / max * 100}%` }} /></div><span className="hint">{row.value}</span></div>)}{!rows.length && <p>No activity yet.</p>}</section>;
}
export default function StaffAnalytics() {
  const { profile } = useApp();
  const admin = profile.role === "admin";
  const result = useRemoteData("moderation/analytics");
  const data = result.data;
  const count = value => Number.isSafeInteger(value) && value >= 0;
  const rows = value => Array.isArray(value) && value.every(row => typeof row.id === "string" && typeof row.label === "string" && count(row.value));
  const valid = data && data.id === profile.id && data.role === profile.role && Number.isFinite(Date.parse(data.as_of)) &&
    ["traces", "approved", "pending", "rejected", "needs_revision", "comments", "completions", "my_reviews", "my_report_decisions"].every(key => count(data[key])) && rows(data.categories) &&
    (!admin || (count(data.users) && count(data.active_users) && rows(data.reviewers)));
  const error = result.error || (data && !valid ? "Unable to verify analytics. Refresh to try again." : "");
  return <div className="wrap">
    <div className="vhead"><span className="eyebrow">View analytics</span><h2>{admin ? "Platform analytics" : "Moderation analytics"}</h2><p>All-time saved activity. Trace totals exclude drafts, hidden content, and deleted content.</p></div>
    <button className="btn outline sm" disabled={result.loading} onClick={result.retry}>Refresh analytics</button>
    <RemoteState {...result} error={error} />
    {!result.loading && !error && valid && <>
      <p className="hint">Updated {new Date(data.as_of).toLocaleString()}</p>
      <div className="g4">{(admin ? [[data.users,"total accounts"],[data.traces,"submitted traces"],[data.approved,"approved"],[data.pending,"pending"]] : [[data.traces,"submitted traces"],[data.approved,"approved"],[data.pending,"pending"],[data.rejected,"rejected"]]).map(([value,label]) => <div className="stat" key={label}><b>{value}</b><span>{label}</span></div>)}</div>
      <div className="g2 admin-analytics-grid">
        <Bars title="Trace status" rows={[{label:"Approved",value:data.approved},{label:"Pending",value:data.pending},{label:"Rejected",value:data.rejected},{label:"Needs revision",value:data.needs_revision}]} />
        <Bars title="Category breakdown" rows={data.categories} />
        <Bars title="Community engagement" rows={[...(admin ? [{label:"Active accounts",value:data.active_users}] : []),{label:"Visible comments",value:data.comments},{label:"Tide completions",value:data.completions}]} />
        <Bars title="My moderation activity" rows={[{label:"Trace reviews",value:data.my_reviews},{label:"Report decisions",value:data.my_report_decisions}]} />
      </div>
      <p className="hint">Active accounts means accounts that are not suspended, not recently online users. Visible comments belong to the included Traces. Tide completions count saved member–lesson completion records, including archived lessons. Review counts include repeat reviews after revisions.</p>
      {admin && <Bars title="Staff activity · trace reviews" rows={data.reviewers} />}
    </>}
  </div>;
}
