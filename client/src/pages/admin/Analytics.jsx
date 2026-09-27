import React from "react";
import { useApp } from "../../context/AppContext.jsx";

function Bars({ title, rows }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return <section className="card admin-chart"><h3 className="lbl">{title}</h3>{rows.map((row) => <div className="admin-bar-row" key={row.label}><span>{row.label}</span><div className="admin-bar-track" aria-hidden="true"><div style={{ width: `${row.value / max * 100}%` }} /></div><span className="hint">{row.value}</span></div>)}{!rows.length && <p className="hint">No activity yet.</p>}</section>;
}
export default function Analytics() {
  const { users, traces, moderators, categories, tides } = useApp();
  const approved = traces.filter((trace) => trace.status === "approved").length;
  const pending = traces.filter((trace) => trace.status === "pending").length;
  const categoryRows = categories.map((label) => ({ label, value: traces.filter((trace) => trace.category === label).length })).sort((a, b) => b.value - a.value);
  return <div className="wrap">
    <div className="vhead"><span className="eyebrow claye">View analytics</span><h2>Platform analytics</h2><p>Totals → status split → top categories → engagement → moderator activity.</p></div>
    <p className="hint admin-preview-note">Demo analytics, calculated from sample data. These are not live platform totals.</p>
    <div className="g4">{[[users.length, "total users"], [traces.length, "total traces"], [approved, "approved"], [pending, "pending"]].map(([value, label]) => <div className="stat" key={label}><b>{value}</b><span>{label}</span></div>)}</div>
    <div className="g2 admin-analytics-grid"><Bars title="Top categories" rows={categoryRows} /><Bars title="Community engagement" rows={[
      { label: "Active accounts", value: users.filter((user) => user.status === "active").length },
      { label: "Comments posted", value: traces.reduce((sum, trace) => sum + (trace.comments?.length || 0), 0) },
      { label: "Lessons completed", value: tides.filter((tide) => tide.progress === 100).length },
    ]} /></div>
    <Bars title="Moderator activity · reviews" rows={moderators.map((mod) => ({ label: mod.name, value: mod.reviewed }))} />
  </div>;
}
