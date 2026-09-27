import React from "react";
import { useApp } from "../../context/AppContext.jsx";
import { categoryLabel } from "./TraceMarker.jsx";

function Breakdown({ title, rows }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return <section className="card mod-chart"><h3 className="lbl">{title}</h3>{rows.map(({ label, value }) => <div className="mod-chart-row" key={label}><span>{label}</span><div className="mod-chart-track" aria-hidden="true"><span style={{ width: `${value / max * 100}%` }} /></div><span className="hint">{value}</span></div>)}</section>;
}
export default function Analytics() {
  const { traces, users, tides } = useApp();
  const categories = [...new Set(traces.map((trace) => categoryLabel(trace.category)))];
  const stats = [[traces.length, "total traces"], [traces.filter((trace) => trace.status === "approved").length, "approved"], [traces.filter((trace) => trace.status === "pending").length, "pending"], [traces.filter((trace) => trace.status === "rejected").length, "rejected"]];
  return <div className="wrap">
    <div className="vhead"><span className="eyebrow teale">View analytics</span><h2>Moderation analytics</h2><p>Summary → category breakdown → user engagement.</p></div>
    <p className="hint mod-demo-note">Demo analytics from sample data. These are not live platform totals.</p>
    <div className="g4">{stats.map(([value, label]) => <div className="stat" key={label}><b>{value}</b><span>{label}</span></div>)}</div>
    <div className="g2 mod-analytics-grid"><Breakdown title="Category breakdown" rows={categories.map((label) => ({ label, value: traces.filter((trace) => categoryLabel(trace.category) === label).length }))} /><Breakdown title="User engagement" rows={[
      { label: "Active accounts", value: users.filter((user) => user.status === "active").length },
      { label: "Traces uploaded", value: traces.length },
      { label: "Comments posted", value: traces.reduce((sum, trace) => sum + (trace.comments?.length || 0), 0) },
      { label: "Lessons started", value: tides.filter((tide) => tide.progress > 0).length },
    ]} /></div>
  </div>;
}
