import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext.jsx";

// keepPrevious: while a new request for the same account is running, keep returning the last
// successful result (with refreshing: true) instead of dropping to a loading state. Use it for
// lists the user filters or pages through, never for records identified by the path.
export default function useRemoteData(path, { collection = false, keepPrevious = false, object = false } = {}) {
  const { readData, profile } = useApp();
  const [attempt, setAttempt] = useState(0);
  const key = `${profile?.id}:${path}:${attempt}`;
  const [result, setResult] = useState(null);
  const last = useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    if (path) readData(path, { signal: controller.signal }).then((data) => {
      if (collection ? !Array.isArray(data) : !data || typeof data !== "object" || (!object && !data.id)) throw new Error("The service returned an unexpected response. Please try again.");
      if (active) { if (keepPrevious) last.current = { profileId: profile?.id, data }; setResult({ key, data, error: "" }); }
    }).catch((error) => {
      if (active) setResult({ key, data: null, error: error.status === 404 || error.status === 400 ? "This record could not be found." : error.message });
    });
    return () => { active = false; controller.abort(); };
  }, [key, path, readData, collection, object]);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const current = result?.key === key;
  const reuse = !current && keepPrevious && Boolean(last.current) && last.current.profileId === profile?.id;
  return { data: current ? result.data : reuse ? last.current.data : null, error: current ? result.error : "", loading: Boolean(path) && !current && !reuse, refreshing: Boolean(path) && reuse, retry };
}
