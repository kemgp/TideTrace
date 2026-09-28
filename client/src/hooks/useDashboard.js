import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext.jsx";

const counts = {
  user: ["traces", "drafts", "pending", "approved", "needs_revision", "comments_posted", "tides_finished"],
  moderator: ["pending", "flagged_comments", "open_reports", "reviewed_today"],
  admin: ["users", "active_users", "moderators", "published_traces", "published_tides", "pending", "open_reports"],
};

export default function useDashboard() {
  const { profile, readData } = useApp();
  const key = `${profile.id}:${profile.role}`;
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const refresh = useRef(null);
  useEffect(() => {
    let active = true;
    let controller;
    async function load() {
      if (controller) return;
      controller = new AbortController();
      try {
        const data = await readData("dashboard", { signal: controller.signal });
        if (data?.id !== profile.id || data.role !== profile.role || !counts[data.role] || !counts[data.role].every((field) => Number.isSafeInteger(data[field]) && data[field] >= 0) || !Number.isFinite(Date.parse(data.as_of)) || (data.role === "user" && !Number.isFinite(Date.parse(data.member_since)))) throw new Error("Dashboard totals could not be verified. Please try again.");
        if (active) setResult({ key, data, error: "" });
      } catch (failure) {
        if (active) setResult({ key, data: null, error: failure.message });
      } finally { controller = null; }
    }
    refresh.current = load;
    load();
    const visibleRefresh = () => { if (document.visibilityState !== "hidden") load(); };
    const interval = setInterval(visibleRefresh, 30000);
    window.addEventListener("focus", visibleRefresh);
    document.addEventListener("visibilitychange", visibleRefresh);
    return () => { active = false; controller?.abort(); clearInterval(interval); window.removeEventListener("focus", visibleRefresh); document.removeEventListener("visibilitychange", visibleRefresh); };
  }, [key, profile.id, profile.role, readData, attempt]);
  const current = result?.key === key ? result : null;
  return { data: current?.data, error: current?.error || "", loading: !current, retry, refresh: () => refresh.current?.() };
}
