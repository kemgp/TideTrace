import React from "react";
import useDashboard from "../hooks/useDashboard.js";
import DashboardStats from "./DashboardStats.jsx";
export default function UsageActivity() {
  const result = useDashboard();
  return <div className="card">
    <DashboardStats result={result} usage items={[["traces", "Your Traces"], ["comments_posted", "Comments posted"], ["tides_finished", "Tides finished"]]} />
    <div className="setrow"><div className="l">Member since</div><span className="hint">{result.data ? new Date(result.data.member_since).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "—"}</span></div>
  </div>;
}
