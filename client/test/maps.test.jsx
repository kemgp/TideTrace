import React, { StrictMode, useState } from "react";
import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import TraceMap from "../src/components/TraceMap.jsx";
import { loadMaps, lookupPinLocation, mapsConfigured, onMapAuthFailure } from "../src/api/maps.js";

vi.mock("../src/api/maps.js", async (original) => ({ ...await original(), loadMaps: vi.fn(), lookupPinLocation: vi.fn(), mapsConfigured: vi.fn(() => true), onMapAuthFailure: vi.fn(() => () => {}) }));
let maps, markers;
beforeEach(() => {
  maps = []; markers = [];
  lookupPinLocation.mockReset().mockResolvedValue(null);
  class Map {
    constructor(host, options) { this.options = options; this.handlers = {}; this.removers = []; maps.push(this); }
    addListener(name, handler) { this.handlers[name] = handler; const remove = vi.fn(); this.removers.push(remove); return { remove }; }
    setOptions = vi.fn();
    panTo = vi.fn();
  }
  class AdvancedMarkerElement {
    constructor(options) { Object.assign(this, options); this.handlers = {}; this.removers = []; markers.push(this); }
    addListener(name, handler) { this.handlers[name] = handler; const remove = vi.fn(); this.removers.push(remove); return { remove }; }
  }
  loadMaps.mockResolvedValue({ Map, marker: { AdvancedMarkerElement } });
  mapsConfigured.mockReturnValue(true);
  onMapAuthFailure.mockImplementation(() => () => {});
});
afterEach(() => vi.unstubAllEnvs());
function Picker({ initial = { latitude: null, longitude: null }, disabled = false }) {
  const [point, setPoint] = useState(initial);
  return <TraceMap {...point} onChange={setPoint} disabled={disabled} />;
}
async function openMap() {

  await waitFor(() => expect(maps.length).toBe(1));
  act(() => maps[0].handlers.tilesloaded());
}
it("loads automatically with a skeleton, places, drags and clears a pin including zero coordinates", async () => {
  loadMaps.mockClear();
  render(<StrictMode><Picker /></StrictMode>);
  expect(screen.getByText("Loading map…")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /location on map/ })).toBeNull();
  await openMap();
  expect(screen.queryByText("Loading map…")).toBeNull();
  expect(markers[0].map).toBeNull();
  act(() => maps[0].handlers.click({ latLng: { lat: () => 0, lng: () => 0 } }));
  await screen.findByText("Selected coordinates: 0.000000, 0.000000");
  expect(markers[0].map).toBe(maps[0]);
  act(() => { markers[0].position = { lat: 10.12345678, lng: 124.87654321 }; markers[0].handlers.dragend(); });
  await screen.findByText("Selected coordinates: 10.123457, 124.876543");
  fireEvent.click(screen.getByRole("button", { name: "Clear pin" }));
  expect(markers[0].map).toBeNull();
  expect(screen.queryByText(/Selected coordinates/)).toBeNull();
});
it("restores a saved pin and never changes it from a read-only map", async () => {
  render(<TraceMap latitude={10} longitude={124} />);
  await openMap();
  expect(maps[0].options.center).toEqual({ lat: 10, lng: 124 });
  expect(markers[0].gmpDraggable).toBe(false);
  expect(maps[0].handlers.click).toBeUndefined();
  expect(markers[0].handlers.dragend).toBeUndefined();
  expect(screen.queryByRole("button", { name: "Clear pin" })).toBeNull();
});
it("locks an open picker during saves and removes its listeners on unmount", async () => {
  const view = render(<Picker initial={{ latitude: 10, longitude: 124 }} />);
  await openMap();
  view.rerender(<Picker initial={{ latitude: 10, longitude: 124 }} disabled />);
  expect(markers[0].gmpDraggable).toBe(false);
  act(() => maps[0].handlers.click({ latLng: { lat: () => 11, lng: () => 125 } }));
  expect(screen.getByText("Selected coordinates: 10.000000, 124.000000")).toBeTruthy();
  view.unmount();
  expect(markers[0].map).toBeNull();
  expect(maps[0].removers[0]).toHaveBeenCalled();
  expect(markers[0].removers[0]).toHaveBeenCalled();
});
it("keeps coordinates usable when the API fails or no key is configured", async () => {
  loadMaps.mockRejectedValue(new Error("Map could not load"));
  const view = render(<Picker initial={{ latitude: 10, longitude: 124 }} />);
  await screen.findByRole("alert");
  expect(screen.getByText("Selected coordinates: 10.000000, 124.000000")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Clear pin" }));
  view.unmount();
  mapsConfigured.mockReturnValue(false);
  render(<Picker />);
  expect(screen.getByText(/Map preview is unavailable/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Choose location on map" })).toBeNull();
});
it("does not create a map when loading completes after unmount", async () => {
  let finish;
  loadMaps.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const view = render(<Picker />);
  view.unmount();
  await act(async () => finish({ Map: vi.fn(), marker: {} }));
  expect(maps).toHaveLength(0);
});
it("shows a map authentication failure after initialization without clearing the pin", async () => {
  let fail;
  onMapAuthFailure.mockImplementation((handler) => { fail = handler; return () => {}; });
  render(<Picker initial={{ latitude: 10, longitude: 124 }} />);
  await openMap();
  act(() => fail());
  await screen.findByRole("alert");
  expect(screen.getByText("Selected coordinates: 10.000000, 124.000000")).toBeTruthy();
});

it("saves a picked pin through the real draft form, restores it and persists clearing it", async () => {
  const { default: App } = await import("../src/App.jsx");
  const { MemoryRouter } = await import("react-router-dom");
  const { SESSION_KEY } = await import("../src/api/session.js");
  const categoryId = "30000000-0000-4000-8000-000000000001";
  const traceId = "20000000-0000-4000-8000-000000000001";
  let saved;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "live-access", refresh_token: "refresh", expires_at: Date.now() / 1000 + 3600 }));
  const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
  const fetch = vi.fn(async (url, options) => {
    if (url === "/api/auth/me") return ok({ id: "current-user", role: "user", status: "active", display_name: "Member" });
    if (url === "/api/categories") return ok([{ id: categoryId, name: "Seagrass" }]);
    if (url === "/api/traces" && options.method === "POST" || url === `/api/traces/${traceId}` && options.method === "PUT") {
      saved = { ...JSON.parse(options.body), id: traceId, author_id: "current-user", status: "draft", version: (saved?.version || 0) + 1, trace_media: [] };
      return ok(saved);
    }
    if (url === `/api/contributions/${traceId}`) return ok(saved);
    return ok([]);
  });
  vi.stubGlobal("fetch", fetch);
  render(<StrictMode><MemoryRouter initialEntries={["/user/traces/upload"]}><App /></MemoryRouter></StrictMode>);
  await screen.findByRole("option", { name: "Seagrass" });
  fireEvent.change(screen.getByLabelText("Category (required)"), { target: { value: categoryId } });
  fireEvent.change(screen.getByLabelText("Location"), { target: { value: "Lawis shoreline" } });
  await openMap();
  act(() => maps[0].handlers.click({ latLng: { lat: () => 10.2, lng: () => 124.3 } }));
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await screen.findByRole("link", { name: "Edit draft" });
  expect(saved).toMatchObject({ latitude: 10.2, longitude: 124.3, location_name: "Lawis shoreline" });
  expect(screen.getByText("Saved coordinates: 10.200000, 124.300000")).toBeTruthy();
  fireEvent.click(screen.getByRole("link", { name: "Edit draft" }));
  await screen.findByRole("option", { name: "Seagrass" });
  expect(screen.getByText("Selected coordinates: 10.200000, 124.300000")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Clear pin" }));
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await screen.findByRole("link", { name: "Edit draft" });
  expect(saved).toMatchObject({ latitude: null, longitude: null });
  expect(fetch.mock.calls.filter(([, options]) => ["POST", "PUT"].includes(options.method))).toHaveLength(2);
});


it("shows the pin address as a guide without editing the entered location", async () => {
  const change = vi.fn();
  lookupPinLocation.mockResolvedValue("Lawis, Philippines");
  render(<TraceMap latitude={10} longitude={124} onChange={change} />);
  await screen.findByText(/Lawis, Philippines/);
  expect(screen.getByText(/Selected coordinates: 10.000000, 124.000000/)).toBeTruthy();
  expect(change).not.toHaveBeenCalled();
});

it("ignores an old lookup when the pin moves and handles lookup failures", async () => {
  let finish;
  lookupPinLocation.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; })).mockRejectedValueOnce(new Error("Quota"));
  const view = render(<TraceMap latitude={10} longitude={124} />);
  await waitFor(() => expect(lookupPinLocation).toHaveBeenCalledTimes(1));
  view.rerender(<TraceMap latitude={11} longitude={125} />);
  await act(async () => finish("Old location"));
  expect(screen.queryByText(/Old location/)).toBeNull();
  await screen.findByText(/Location name unavailable/);
  expect(screen.getByText("Saved coordinates: 11.000000, 125.000000")).toBeTruthy();
});
