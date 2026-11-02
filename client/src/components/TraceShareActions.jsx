import React, { useEffect, useRef, useState } from "react";

// A plain link to the pin in Google Maps; shown only when the trace has a public pin.
export function OpenInMaps({ latitude, longitude }) {
  if (latitude == null || longitude == null) return null;
  const query = encodeURIComponent(`${latitude},${longitude}`);
  return <a className="trace-detail__link" href={`https://www.google.com/maps/search/?api=1&query=${query}`} target="_blank" rel="noopener noreferrer">Open in Maps<span className="sr-only"> (opens in a new tab)</span></a>;
}

// Copies the page address. The menu item text is the confirmation, so no toast is needed.
export function useCopyLink() {
  const [state, setState] = useState("idle");
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(window.location.href);
      setState("copied");
    } catch {
      setState("failed");
    }
    timer.current = setTimeout(() => setState("idle"), 2500);
  };
  return { state, copy };
}
