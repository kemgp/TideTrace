import { useEffect, useState } from "react";
import { getData } from "../api/data.js";
export const communityMetrics = [
 ["published_traces", "Traces published"],
 ["contributors", "Community contributors"],
 ["published_tides", "Tides available"],
 ["tides_completed", "Tides completed"],
];
export default function useCommunitySummary() {
 const [attempt, setAttempt] = useState(0);
 const [state, setState] = useState({ loading: true, data: null, error: "" });
 useEffect(() => {
  const controller = new AbortController(); let active = true;
  setState({ loading: true, data: null, error: "" });
  getData("community-summary", { signal: controller.signal }).then(data => {
   if (data?.id !== "community" || !Number.isFinite(Date.parse(data.as_of)) || !communityMetrics.every(([key]) => Number.isSafeInteger(data[key]) && data[key] >= 0) || data.contributors > data.published_traces) throw new Error("Community totals are unavailable. Please try again.");
   if (active) setState({ loading: false, data, error: "" });
  }).catch(() => { if (active) setState({ loading: false, data: null, error: "Community totals are unavailable. Please try again." }); });
  return () => { active = false; controller.abort(); };
 }, [attempt]);
 return { ...state, retry: () => setAttempt(n => n+1) };
}
