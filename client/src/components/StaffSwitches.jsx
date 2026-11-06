import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import useDashboard from "../hooks/useDashboard.js";

// A segmented control that moves between pages. It looks like the app's other segmented controls
// (`archive-view-switch`) but is made of links, so the current page is marked with aria-current.
export function SegmentedLinks({ label, items }) {
  return <nav className="archive-view-switch staff-switch" aria-label={label}>
    {items.map(({ to, text, active }) => <Link key={to} className="btn ghost sm" to={to} aria-current={active ? "page" : undefined}>{text}</Link>)}
  </nav>;
}

// Review area: the Trace queue and the Reports view. The open-reports count is the existing dashboard
// total (one cheap aggregate), shown once it has loaded.
export function ReviewSwitch() {
  const { role } = useApp();
  const { pathname } = useLocation();
  const base = role === "admin" ? "/admin" : "/moderator";
  const totals = useDashboard();
  const open = totals.data?.open_reports;
  return <SegmentedLinks label="Review views" items={[
    { to: `${base}/review`, text: "Queue", active: pathname !== `${base}/reports` },
    { to: `${base}/reports`, text: Number.isSafeInteger(open) ? `Reports (${open})` : "Reports", active: pathname === `${base}/reports` },
  ]} />;
}

// People: accounts and the moderation team. /admin/moderators?add=1 keeps working because the page itself reads it.
export function PeopleSwitch() {
  const { pathname } = useLocation();
  return <SegmentedLinks label="People views" items={[
    { to: "/admin/users", text: "Users", active: pathname === "/admin/users" },
    { to: "/admin/moderators", text: "Moderators", active: pathname === "/admin/moderators" },
  ]} />;
}

// Insights: platform analytics and the moderation history.
export function InsightsSwitch() {
  const { pathname } = useLocation();
  return <SegmentedLinks label="Insights views" items={[
    { to: "/admin/analytics", text: "Analytics", active: pathname === "/admin/analytics" },
    { to: "/admin/review/history", text: "History", active: pathname === "/admin/review/history" },
  ]} />;
}
