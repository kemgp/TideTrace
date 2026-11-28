import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { peekRead } from "../api/readCache.js";

// keepPrevious: while a new request for the same account is running, keep returning the last
// successful result (with refreshing: true) instead of dropping to a loading state. Use it for
// lists the user filters or pages through, never for records identified by the path.
// Coming back to a path read in the last five minutes shows that answer at once (refreshing: true) while it is
// read again (see api/readCache.js); the copy is for this exact path and account only.
export default function useRemoteData(path, { collection = false, keepPrevious = false, object = false } = {}) {
  const valid = (data) => collection ? Array.isArray(data) : Boolean(data) && typeof data === "object" && (object || Boolean(data.id));
  const { readData, profile } = useApp();
  const [attempt, setAttempt] = useState(0);
  const key = `${profile?.id}:${path}:${attempt}`;
  const [result, setResult] = useState(null);
  const last = useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    if (path) readData(path, { signal: controller.signal }).then((data) => {
      if (!valid(data)) throw new Error("The service returned an unexpected response. Please try again.");
      if (active) { if (keepPrevious) last.current = { profileId: profile?.id, data }; setResult({ key, data, error: "" }); }
    }).catch((error) => {
      if (active) setResult({ key, data: null, error: error.status === 404 || error.status === 400 ? "This record could not be found." : error.message, notFound: error.status === 404 || error.status === 400 });
    });
    return () => { active = false; controller.abort(); };
  }, [key, path, readData, collection, object]);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const current = result?.key === key;
  const reuse = !current && keepPrevious && Boolean(last.current) && last.current.profileId === profile?.id;
  const cached = !current && !reuse && path ? peekRead(profile?.id, path) : undefined;
  const fromCache = cached !== undefined && valid(cached);
  return { data: current ? result.data : reuse ? last.current.data : fromCache ? cached : null, error: current ? result.error : "", notFound: current ? Boolean(result.notFound) : false, loading: Boolean(path) && !current && !reuse && !fromCache, refreshing: Boolean(path) && (reuse || fromCache), retry };
}
