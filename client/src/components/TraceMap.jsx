import React, { useEffect, useRef, useState } from "react";
import "./TraceMap.css";
import { coordinates, lookupPinLocation, loadMaps, mapId, mapsConfigured, onMapAuthFailure } from "../api/maps.js";

export default function TraceMap({ latitude, longitude, onChange, disabled = false }) {
  const position = coordinates(latitude, longitude);
  const editable = typeof onChange === "function";
  const enabled = mapsConfigured() && (editable || Boolean(position));
  const [state, setState] = useState("loading");
  const [pinLabel, setPinLabel] = useState(null);
  const pinKey = position ? `${position.lat},${position.lng}` : null;
  const [error, setError] = useState("");
  const host = useRef(null);
  const instance = useRef(null);
  const latest = useRef({ position, onChange, disabled });
  latest.current = { position, onChange, disabled };
  useEffect(() => {
    if (!enabled) return;
    setState("loading"); setError("");
    let active = true;
    let map, marker;
    const timer = setTimeout(() => { if (active) { setState("error"); setError("The map took too long to load. Your location is still available; reload the page to try again."); } }, 25000);
    const listeners = [];
    const unsubscribe = onMapAuthFailure(() => {
      if (active) { clearTimeout(timer); setState("error"); setError("Map access is unavailable. Your location name and selected coordinates are still available."); }
    });
    loadMaps().then((maps) => {
      if (!active) return;
      const current = latest.current;
      map = new maps.Map(host.current, { center: current.position || { lat: 12.8797, lng: 121.774 }, zoom: current.position ? 15 : 6, mapId: mapId(), streetViewControl: false, mapTypeControl: false, gestureHandling: "cooperative" });
      marker = new maps.marker.AdvancedMarkerElement({ map: current.position ? map : null, position: current.position || undefined, title: editable ? "Trace location — drag to adjust" : "Saved Trace location", gmpDraggable: editable && !current.disabled });
      const update = (point) => {
        if (!active || latest.current.disabled || !editable || !point) return;
        const lat = typeof point.lat === "function" ? point.lat() : point.lat;
        const lng = typeof point.lng === "function" ? point.lng() : point.lng;
        const valid = coordinates(lat, lng);
        if (valid) latest.current.onChange({ latitude: Number(valid.lat.toFixed(6)), longitude: Number(valid.lng.toFixed(6)) });
      };
      if (editable) {
        listeners.push(map.addListener("click", (event) => update(event.latLng)));
        listeners.push(marker.addListener("dragend", () => update(marker.position)));
      }
      instance.current = { map, marker };
      listeners.push(map.addListener("tilesloaded", () => {
        if (active) { clearTimeout(timer); setState((currentState) => currentState === "error" ? currentState : "ready"); }
      }));
    }).catch((failure) => { if (active) { clearTimeout(timer); setState("error"); setError(failure.message); } });
    return () => {
      active = false; clearTimeout(timer); unsubscribe();
      listeners.forEach((listener) => listener.remove());
      if (marker) marker.map = null;
      instance.current = null;
      host.current?.replaceChildren();
    };
  }, [enabled, editable]);
  useEffect(() => {
    const current = instance.current;
    if (!current) return;
    current.marker.gmpDraggable = editable && !disabled;
    current.marker.position = position || undefined;
    current.marker.map = position ? current.map : null;
    if (position) current.map.panTo(position);
    current.map.setOptions({ gestureHandling: disabled ? "none" : "cooperative", keyboardShortcuts: !disabled });
  }, [latitude, longitude, disabled, editable, state]);

  useEffect(() => {
    if (!enabled || !pinKey) return;
    const controller = new AbortController();
    let active = true;
    // Debounce clicks; dragging only changes coordinates when released.
    const timer = setTimeout(() => {
      lookupPinLocation({ lat: Number(pinKey.split(",")[0]), lng: Number(pinKey.split(",")[1]) }, controller.signal)
        .then((name) => { if (active) setPinLabel({ key: pinKey, text: name || "No nearby address found." }); })
        .catch(() => { if (active) setPinLabel({ key: pinKey, text: "Location name unavailable." }); });
    }, 400);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [pinKey, enabled]);

  if (!editable && !position) return <p className="hint">No map pin was saved for this Trace.</p>;
  return <section aria-label={editable ? "Choose Trace location" : "Saved Trace location"} style={{ marginBlock: 16 }}>
    {editable && <p className="hint">Optional: click the map to place a pin, or drag the pin to adjust it. Keep the location name descriptive.</p>}
    {position && <p className="hint" role="status">{editable ? "Selected" : "Saved"} coordinates: {position.lat.toFixed(6)}, {position.lng.toFixed(6)}</p>}
    {position && <p className="hint" aria-live="polite"><b>Pin location (approximate):</b> {enabled ? pinLabel?.key === pinKey ? pinLabel.text : "Looking up location…" : "Location name unavailable."}</p>}
    {!mapsConfigured() && <p className="hint">Map preview is unavailable.{editable ? " You can still save the location name." : ""}</p>}
    {enabled && <>
      {error && <p role="alert">{error}</p>}
      <div className="trace-map-frame" aria-busy={state === "loading"} hidden={state === "error"}>
        <div ref={host} className="trace-map-canvas" aria-label="Trace location map" />
        {state === "loading" && <div className="trace-map-skeleton" role="status">
          <span className="trace-map-skeleton__pin" aria-hidden="true" />
          <span>Loading map…</span>
        </div>}
      </div>
    </>}
    {editable && position && <button type="button" className="btn ghost sm" disabled={disabled} onClick={() => onChange({ latitude: null, longitude: null })}>Clear pin</button>}
  </section>;
}
