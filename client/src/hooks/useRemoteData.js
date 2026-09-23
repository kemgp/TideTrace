import { useCallback, useEffect, useState } from "react";
import { useApp } from "../context/AppContext.jsx";

export default function useRemoteData(path, { collection = false } = {}) {
  const { readData, profile } = useApp();
  const [attempt, setAttempt] = useState(0);
  const key = `${profile?.id}:${path}:${attempt}`;
  const [result, setResult] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    if (path) readData(path, { signal: controller.signal }).then((data) => {
      if (collection ? !Array.isArray(data) : !data || typeof data !== "object" || !data.id) throw new Error("The service returned an unexpected response. Please try again.");
      if (active) setResult({ key, data, error: "" });
    }).catch((error) => {
      if (active) setResult({ key, data: null, error: error.status === 404 || error.status === 400 ? "This record could not be found." : error.message });
    });
    return () => { active = false; controller.abort(); };
  }, [key, path, readData, collection]);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { data: result?.key === key ? result.data : null, error: result?.key === key ? result.error : "", loading: Boolean(path) && result?.key !== key, retry };
}
