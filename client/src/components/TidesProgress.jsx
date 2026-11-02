import React from "react";
import useDashboard from "../hooks/useDashboard.js";
import useRemoteData from "../hooks/useRemoteData.js";
import "./TideCard.css";

// "3 of 12 completed" with a bar. The member's finished count comes from the dashboard totals and the
// number of published lessons from the community summary. Nothing shows if either is unavailable.
export default function TidesProgress() {
  const totals = useDashboard();
  const community = useRemoteData("community-summary", { object: true });
  const total = community.data?.published_tides;
  const finished = totals.data?.tides_finished;
  if (!Number.isInteger(total) || !Number.isInteger(finished) || total <= 0) return null;
  // A lesson that was finished and later unpublished must not push the count past the total.
  const done = Math.min(finished, total);
  const percent = Math.round((done / total) * 100);
  return <div className="tides-progress">
    <div className="tides-progress-row"><span><b>{done} of {total}</b> completed</span><span>{percent}%</span></div>
    <div className="tides-progress-bar" role="progressbar" aria-label="Lessons completed" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}><span style={{ width: `${percent}%` }} /></div>
  </div>;
}
