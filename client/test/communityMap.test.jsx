import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import CommunityMap from "../src/components/CommunityMap.jsx";
import { useApp } from "../src/context/AppContext.jsx";
import { loadMaps, mapsConfigured, onMapAuthFailure } from "../src/api/maps.js";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
vi.mock("../src/context/AppContext.jsx", () => ({ useApp: vi.fn() }));
vi.mock("../src/api/maps.js", async (original) => ({ ...await original(), loadMaps: vi.fn(), mapsConfigured: vi.fn(), onMapAuthFailure: vi.fn() }));
vi.mock("@googlemaps/markerclusterer", () => ({ MarkerClusterer: vi.fn(class { clearMarkers = vi.fn(); setMap = vi.fn(); }) }));
let map, markers, readData;
const pin = { id: "trace-1", title: "Reef observation", category: { name: "Coral" }, location_name: "Coast", latitude: 10, longitude: 124 };
beforeEach(() => {
  markers = []; map = null;
  mapsConfigured.mockReturnValue(true);
  onMapAuthFailure.mockReturnValue(() => {});
  readData = vi.fn().mockResolvedValue({ pins: [pin], truncated: true });
  useApp.mockReturnValue({ readData });
  loadMaps.mockResolvedValue({ Map: class {
    constructor(host, options) { map = this; this.options = options; this.handlers = {}; }
    addListener(name, handler) { this.handlers[name] = handler; return { remove: vi.fn() }; }
    getBounds() { return { toJSON: () => ({ south: 0, north: 20, west: 120, east: 130 }) }; }
    getCenter() { return { lat: () => 12, lng: () => 125 }; }
    panTo = vi.fn();
  }, marker: { AdvancedMarkerElement: class {
    constructor(options) { Object.assign(this, options); this.handlers = {}; markers.push(this); }
    addListener(name, handler) { this.handlers[name] = handler; return { remove: vi.fn() }; }
  } } });
});
function Destination() { const location = useLocation(); return <output>{JSON.stringify(location.state)}</output>; }
function open(props = {}) { return render(<MemoryRouter><CommunityMap query="reef" category="coral" onList={vi.fn()} {...props} /><Destination /></MemoryRouter>); }
async function ready() {
  await waitFor(() => expect(map).toBeTruthy());
  act(() => { map.handlers.tilesloaded(); map.handlers.idle(); });
}
it("fetches viewport filters, clusters pins and offers accessible selection and details", async () => {
  open(); await ready();
  const select = await screen.findByRole("button", { name: /Reef observation/ });
  expect(readData.mock.calls[0][0]).toContain("south=0&north=20&west=120&east=130&q=reef&category_id=coral");
  expect(MarkerClusterer).toHaveBeenCalled();
  expect(screen.getByText(/Zoom in to see more/)).toBeTruthy();
  fireEvent.click(select);
  expect(screen.getByRole("article", { name: "Selected Trace" })).toBeTruthy();
  expect(screen.getAllByRole("link", { name: /View Trace/ })[0].getAttribute("href")).toBe("/user/traces/trace-1");
  act(() => markers[0].handlers.click());
  expect(select.getAttribute("aria-pressed")).toBe("true");
});
it("report mode requires explicit confirmation and carries the chosen coordinates without saving", async () => {
  open(); await ready();
  fireEvent.click(screen.getByRole("button", { name: "Report here" }));
  fireEvent.click(screen.getByRole("button", { name: "Use map center" }));
  expect(screen.getByText(/Select a spot on the map/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Start Trace here" }));
  expect(screen.getByText('{"traceLocation":{"latitude":12,"longitude":125}}')).toBeTruthy();
  expect(readData.mock.calls.every(([, options]) => !options.method)).toBe(true);
});
it("keeps List view available without a configured map", async () => {
  mapsConfigured.mockReturnValue(false);
  const onList = vi.fn(); open({ onList });
  expect(await screen.findByRole("alert")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Browse List view" }));
  expect(onList).toHaveBeenCalled(); expect(readData).not.toHaveBeenCalled();
});
it("aborts an old filter request and ignores its late response", async () => {
  let finish;
  readData.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const view = open(); await ready();
  await waitFor(() => expect(readData).toHaveBeenCalledTimes(1));
  view.rerender(<MemoryRouter><CommunityMap query="new" category="All" onList={vi.fn()} /></MemoryRouter>);
  expect(readData.mock.calls[0][1].signal.aborted).toBe(true);
  readData.mockResolvedValue({ pins: [], truncated: false });
  await screen.findByText(/No public pins in this area/);
  await act(async () => finish({ pins: [pin], truncated: false }));
  expect(screen.queryByRole("button", { name: /Reef observation/ })).toBeNull();
});

it("keeps loaded results and keyboard focus while refreshing the viewport", async () => {
  open(); await ready();
  const select = await screen.findByRole("button", { name: /Reef observation/ });
  select.focus(); fireEvent.click(select);
  expect(map.panTo).not.toHaveBeenCalled();
  readData.mockImplementationOnce(() => new Promise(() => {}));
  map.getBounds = () => ({ toJSON: () => ({ south: 1, north: 20, west: 120, east: 130 }) });
  act(() => map.handlers.idle());
  expect(screen.getByRole("button", { name: /Reef observation/ })).toBe(select);
  expect(document.activeElement).toBe(select);
  expect(screen.getByText("Updating Traces…")).toBeTruthy();
});

it("starts the community map over Iloilo City", async () => {
  open(); await ready();
  expect(map.options.center).toEqual({ lat: 10.7202, lng: 122.5621 });
  expect(map.options.zoom).toBe(12);
});
