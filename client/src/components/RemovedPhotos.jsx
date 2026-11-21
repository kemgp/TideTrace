import React, { useEffect, useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import useRemoteData from "../hooks/useRemoteData.js";
import { shortDate } from "../api/relativeTime.js";
import "./RemovedPhotos.css";

// One photo the author removed while revising. Sent through the API as a file, never as a shareable link.
function RemovedPhoto({ traceId, photo, index }) {
  const { readData } = useApp();
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  const image = photo.mime_type?.startsWith("image/");
  useEffect(() => {
    setUrl("");
    setFailed(false);
    if (!image) return undefined;
    const controller = new AbortController();
    let address = "";
    readData(`moderation/traces/${encodeURIComponent(traceId)}/removed-photos/${encodeURIComponent(photo.id)}/file?size=thumb`, { signal: controller.signal, as: "blob" })
      .then((file) => {
        if (controller.signal.aborted || !file?.size) return;
        address = URL.createObjectURL(file);
        setUrl(address);
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => { controller.abort(); if (address) URL.revokeObjectURL(address); };
  }, [traceId, photo.id, image, readData]);
  const keep = photo.keep_until ? `Kept until ${shortDate(photo.keep_until)}.` : "Kept until 30 days after the final decision.";
  return <li className="removed-photos__item">
    <div className="removed-photos__frame">
      {url
        ? <img src={url} alt={`Removed photo ${index + 1}`} referrerPolicy="no-referrer" />
        : <span className="removed-photos__empty">{!image ? "Video" : failed ? "Could not load" : "Loading…"}</span>}
    </div>
    <p className="removed-photos__meta">Removed {shortDate(photo.removed_at)}. {keep}</p>
  </li>;
}

// Staff only: photos the author swapped out during a revision, kept for review until 30 days after the decision.
export default function RemovedPhotos({ traceId }) {
  const result = useRemoteData(traceId ? `moderation/traces/${encodeURIComponent(traceId)}/removed-photos` : null, { collection: true });
  const photos = result.data || [];
  if (result.error) return <div className="removed-photos"><p role="alert">Could not load removed photos.</p><button type="button" className="btn outline sm" onClick={result.retry}>Try again</button></div>;
  if (!photos.length) return null;
  return <section className="removed-photos" aria-labelledby={`removed-${traceId}`}>
    <h3 id={`removed-${traceId}`}>Removed during revision</h3>
    <p className="hint">The author removed these while revising. Only staff can see them.</p>
    <ul className="removed-photos__list">
      {photos.map((photo, index) => <RemovedPhoto key={photo.id} traceId={traceId} photo={photo} index={index} />)}
    </ul>
  </section>;
}
