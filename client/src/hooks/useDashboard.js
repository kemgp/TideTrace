import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { peekRead } from "../api/readCache.js";

const counts = {
  user: ["traces", "drafts", "pending", "approved", "needs_revision", "comments_posted", "tides_finished"],
  moderator: ["pending", "flagged_comments", "open_reports", "reviewed_today"],
  admin: ["users", "active_users", "moderators", "published_traces", "published_tides", "pending", "open_reports"],
};

// Totals added after the first release. Older databases omit them, so they are checked only when present.
const optionalFieldsValid = (data) => (data.held_traces === undefined || (Number.isSafeInteger(data.held_traces) && data.held_traces >= 0)) && (data.oldest_pending_at == null || Number.isFinite(Date.parse(data.oldest_pending_at)));

const validDashboard = (data, profile) => !(data?.id !== profile.id || data.role !== profile.role || !counts[data.role] || !counts[data.role].every((field) => Number.isSafeInteger(data[field]) && data[field] >= 0) || !Number.isFinite(Date.parse(data.as_of)) || !optionalFieldsValid(data) || (data.role === "user" && !Number.isFinite(Date.parse(data.member_since))));

// Several components show the same totals (the dashboard, staff switches, Tides progress, usage). They share one
// request through readData (see api/readCache.js): mounting and the 30 second timer reuse an answer younger than
// 10 seconds, so instances that mount or tick close together ask once. Focus and visibility always ask again.
// A component that mounts after another has the totals shows them at once while they are read again.
const REUSE_MS = 10000;

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
    async function load(maxAge = 0) {
      if (controller) return;
      controller = new AbortController();
      try {
        const data = await readData("dashboard", { signal: controller.signal, maxAge });
        if (!validDashboard(data, profile)) throw new Error("Dashboard totals could not be verified. Please try again.");
        if (active) setResult({ key, data, error: "" });
      } catch (failure) {
        if (active) setResult({ key, data: null, error: failure.message });
      } finally { controller = null; }
    }
    refresh.current = () => load();
    load(REUSE_MS);
    const visibleRefresh = () => { if (document.visibilityState !== "hidden") load(); };
    const interval = setInterval(() => { if (document.visibilityState !== "hidden") load(REUSE_MS); }, 30000);
    window.addEventListener("focus", visibleRefresh);
    document.addEventListener("visibilitychange", visibleRefresh);
    return () => { active = false; controller?.abort(); clearInterval(interval); window.removeEventListener("focus", visibleRefresh); document.removeEventListener("visibilitychange", visibleRefresh); };
  }, [key, profile.id, profile.role, readData, attempt]);
  const current = result?.key === key ? result : null;
  const cached = current ? undefined : peekRead(profile.id, "dashboard");
  const fromCache = cached !== undefined && validDashboard(cached, profile);
  return { data: current ? current.data : fromCache ? cached : undefined, error: current?.error || "", loading: !current && !fromCache, retry, refresh: () => refresh.current?.() };
}
