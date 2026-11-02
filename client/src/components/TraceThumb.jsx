import React, { useEffect, useMemo, useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { PHOTO_TYPES } from "../api/photos.js";
import { traceColor } from "./TraceCategory.jsx";

// Small square preview for list rows: the first photo when there is one, otherwise the category colour.
// The photo stays hidden until fully loaded and decoded, then fades in. Data Saver skips the request.
export default function TraceThumb({ trace }) {
  const { readData, profile } = useApp();
  const skip = Boolean(profile?.data_saver);
  const photo = useMemo(() => (Array.isArray(trace.trace_media) ? trace.trace_media : [])
    .filter((item) => PHOTO_TYPES.includes(item.mime_type))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0], [trace.trace_media]);
  const [url, setUrl] = useState("");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setUrl("");
    setLoaded(false);
    if (!photo?.id || skip) return undefined;
    const controller = new AbortController();
    readData(`media/${encodeURIComponent(photo.id)}/url`, { signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted && data?.url && /^https?:\/\//.test(data.url)) setUrl(data.url);
    }).catch(() => {});
    return () => controller.abort();
  }, [photo?.id, skip, readData]);
  return <span className="contrib-thumb" aria-hidden="true" style={{ "--thumb-color": traceColor(trace.category) }}>
    {url && <img src={url} alt="" referrerPolicy="no-referrer" decoding="async"
      onLoad={(event) => { const image = event.currentTarget; (image.decode ? image.decode().catch(() => {}) : Promise.resolve()).then(() => setLoaded(true)); }}
      onError={() => setUrl("")} style={{ opacity: loaded ? 1 : 0 }} />}
  </span>;
}
