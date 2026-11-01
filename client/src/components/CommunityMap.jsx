import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { useApp } from "../context/AppContext.jsx";
import { coordinates, loadMaps, mapId, mapsConfigured, onMapAuthFailure } from "../api/maps.js";
import Button from "./Button.jsx";
import "./CommunityMap.css";

export default function CommunityMap({ query, category, onList }) {
  const { readData } = useApp();
  const navigate = useNavigate();
  const host = useRef(null);
  const instance = useRef(null);
  const reporting = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [bounds, setBounds] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [result, setResult] = useState({ pins: [], truncated: false });
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState(null);
  const [reportMode, setReportMode] = useState(false);
  const [point, setPoint] = useState(null);

  useEffect(() => {
    if (!mapsConfigured()) { setError("Map preview is unavailable. You can still browse the list."); return; }
    let active = true;
    let listeners = [];
    let failed = false;
    const fail = (message) => { failed = true; if (active) { setError(message); setReady(false); } };
    const timer = setTimeout(() => fail("The map took too long to load. Reload the page to try again."), 25000);
    const unsubscribe = onMapAuthFailure(() => fail("Map access is unavailable. You can still browse the list."));
    loadMaps().then((maps) => {
      if (!active) return;
      const map = new maps.Map(host.current, { center: { lat: 12.8797, lng: 121.774 }, zoom: 6, mapId: mapId(),
        streetViewControl: false, mapTypeControl: false, gestureHandling: "cooperative" });
      instance.current = { map, maps };
      listeners = [map.addListener("idle", () => {
        if (!active) return;
        const area = map.getBounds()?.toJSON();
        if (area) setBounds((previous) => JSON.stringify(previous) === JSON.stringify(area) ? previous : area);
      }), map.addListener("tilesloaded", () => {
        clearTimeout(timer);
        if (active && !failed) setReady(true);
      }), map.addListener("click", (event) => {
        if (!active || !reporting.current || !event.latLng) return;
        const valid = coordinates(event.latLng.lat(), event.latLng.lng());
        if (valid) setPoint({ latitude: Number(valid.lat.toFixed(6)), longitude: Number(valid.lng.toFixed(6)) });
      })];
    }).catch((failure) => fail(failure.message));
    return () => { active = false; clearTimeout(timer); unsubscribe(); listeners.forEach((listener) => listener.remove()); instance.current = null; };
  }, []);

  useEffect(() => {
    if (!bounds || !ready) return;
    const controller = new AbortController();
    let active = true;
    setLoading(true); setError("");
    const timer = setTimeout(async () => {
      const params = new URLSearchParams(bounds);
      if (query.trim()) params.set("q", query.trim());
      if (category !== "All") params.set("category_id", category);
      try {
        const data = await readData(`traces/map?${params}`, { signal: controller.signal });
        if (!Array.isArray(data?.pins) || typeof data.truncated !== "boolean" || data.pins.some((pin) => !pin.id || !coordinates(pin.latitude, pin.longitude))) throw new Error("Unable to read map results. Please try again.");
        if (active) { setLoaded(true); setResult(data); setSelected((previous) => data.pins.find((pin) => pin.id === previous?.id) || null); }
      } catch (failure) { if (active) setError(failure.message); }
      finally { if (active) setLoading(false); }
    }, 350);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [bounds, ready, query, category, readData, attempt]);

  useEffect(() => {
    if (!ready || !instance.current) return;
    const { maps, map } = instance.current;
    const listeners = [];
    const markers = result.pins.map((pin) => {
      const marker = new maps.marker.AdvancedMarkerElement({ position: coordinates(pin.latitude, pin.longitude), title: pin.title });
      listeners.push(marker.addListener("click", () => setSelected(pin)));
      return marker;
    });
    const clusterer = new MarkerClusterer({ map, markers });
    return () => { listeners.forEach((listener) => listener.remove()); clusterer.clearMarkers(); clusterer.setMap(null); markers.forEach((marker) => { marker.map = null; }); };
  }, [result, ready]);

  useEffect(() => {
    if (!ready || !point || !instance.current) return;
    const { map, maps } = instance.current;
    const marker = new maps.marker.AdvancedMarkerElement({ map, position: coordinates(point.latitude, point.longitude), title: "New Trace location" });
    return () => { marker.map = null; };
  }, [point, ready]);

  const chooseReport = (value) => { reporting.current = value; setReportMode(value); setPoint(null); };
  const confirmPoint = () => navigate("/user/traces/upload", { state: { traceLocation: point } });
  return <section className="community-map" aria-label="Community map">
    <div className="community-map-header">
      <div><h3>Explore the coastline</h3><p>Discover approved Traces shared by the community.</p></div>
      <Button type="button" variant="outline" size="sm" aria-pressed={reportMode} aria-controls="map-report-location" disabled={!ready} onClick={() => chooseReport(!reportMode)}>{reportMode ? "Cancel report location" : "Report here"}</Button>
    </div>
    <div className="community-map-layout">
      <div className="community-map-stage">
        <div className="community-map-frame" aria-busy={!ready && !error}>
          <div ref={host} className="trace-map-canvas" aria-label="Community Trace locations" />
          {!ready && !error && <div className="community-map-loading" role="status"><span className="button-spinner" aria-hidden="true" />Loading map…</div>}
          {!ready && error && <div className="community-map-unavailable"><h4>Map unavailable</h4><p role="alert">{error}</p><Button type="button" variant="outline" size="sm" onClick={onList}>Browse List view</Button></div>}
        </div>
        <p className="community-map-note">Sensitive locations and Traces without pins remain in List view.</p>
      </div>
      <aside className="community-map-results" aria-label="Traces in this map area">
        <div className="community-map-results-heading"><h3>In this area</h3>
          <p className="community-map-count" role="status">{loading ? "Updating Traces…" : loaded ? `${result.pins.length.toLocaleString()} ${result.pins.length === 1 ? "public pin" : "public pins"}` : ready ? "Finding Traces…" : error ? "Results unavailable" : "Waiting for the map"}</p>
        </div>
        <div id="map-report-location" hidden={!reportMode} className="community-map-report">
          <h4>Choose a report location</h4>
          <p>Select a spot on the map or use its center. You can adjust the pin before saving.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => {
            const center = instance.current?.map.getCenter();
            if (center) setPoint({ latitude: Number(center.lat().toFixed(6)), longitude: Number(center.lng().toFixed(6)) });
          }}>Use map center</Button>
          <p className="community-map-coordinates" role="status">{point ? `Selected: ${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}` : "No location selected"}</p>
          {point && <Button type="button" variant="blue" size="sm" onClick={confirmPoint}>Start Trace here</Button>}
        </div>
        {ready && error && <div className="community-map-message" role="alert"><p>{error}</p><Button type="button" variant="outline" size="sm" onClick={() => setAttempt((value) => value + 1)}>Retry map results</Button></div>}
        {result.truncated && <p className="community-map-message">Showing up to 500 pins. Zoom in to see more.</p>}
        {!loading && loaded && !error && !result.pins.length && <div className="community-map-message"><h4>No public pins in this area</h4><p>Try zooming out or changing your filters.</p><Button type="button" variant="outline" size="sm" onClick={onList}>Browse List view</Button></div>}
        {selected && <article className="community-map-preview" aria-label="Selected Trace">
          <span className="community-map-meta">Selected Trace</span><h4>{selected.title}</h4><p>{selected.category?.name} · {selected.location_name}</p>
          <Link className="community-map-link" to={`/user/traces/${selected.id}`}>View Trace<span className="sr-only">: {selected.title}</span></Link>
        </article>}
        <ul className="community-map-list" aria-busy={loading}>{result.pins.map((pin) => <li key={pin.id}>
          <button type="button" className="community-map-result" aria-pressed={selected?.id === pin.id} onClick={() => setSelected(pin)}>
            <span className="community-map-meta">{pin.category?.name || "Trace"}{selected?.id === pin.id && " · Selected"}</span>
            <strong>{pin.title}</strong><span>{pin.location_name}</span>
          </button><Link className="community-map-link" to={`/user/traces/${pin.id}`}>View Trace<span className="sr-only">: {pin.title}</span></Link>
        </li>)}</ul>
      </aside>
    </div>
  </section>;
}
