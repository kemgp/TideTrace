import React from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { pickTiles } from "../src/hooks/useRecentTraces.js";
import RecentTraces from "../src/components/home/RecentTraces.jsx";
import CommunityTotals from "../src/components/home/CommunityTotals.jsx";
import HowItWorks from "../src/components/home/HowItWorks.jsx";
import PublicNavbar from "../src/components/home/PublicNavbar.jsx";

const api = vi.hoisted(() => ({ getData: vi.fn() }));
vi.mock("../src/api/data.js", () => ({ getData: api.getData }));
vi.mock("../src/context/AppContext.jsx", () => ({ useApp: () => ({ role: null }) }));

const photo = (id, extra = {}) => ({ id, mime_type: "image/jpeg", sort_order: 0, ...extra });
const trace = (n, extra = {}) => ({ id: `t${n}`, title: `Trace ${n}`, category: { name: "Birds" }, location_name: "Guimaras Strait",
  is_sensitive: false, trace_media: [photo(`m${n}`)], author: { display_name: "Private Person" }, latitude: 10.7, longitude: 122.5, ...extra });

// Intersection observer that reports every element as visible straight away.
function visibleObserver() {
  const callbacks = [];
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback) { this.callback = callback; callbacks.push(callback); }
    observe(target) { this.callback([{ target, isIntersecting: true }]); }
    unobserve() {} disconnect() {}
  });
  return callbacks;
}
function matchMedia(reduced = false) {
  vi.stubGlobal("matchMedia", vi.fn(query => ({ matches: reduced && query === "(prefers-reduced-motion: reduce)", media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
}
beforeEach(() => { api.getData.mockReset(); matchMedia(); });

it("keeps only approved, non-sensitive traces that have a photo, and drops author and coordinates", () => {
  const rows = [
    trace(1), trace(2, { is_sensitive: true }), trace(3, { trace_media: [] }),
    trace(4, { trace_media: [{ id: "doc", mime_type: "application/pdf" }] }),
    trace(5, { trace_media: [photo("late", { sort_order: 2 }), photo("early", { sort_order: 1 })] }),
    null, ...Array.from({ length: 20 }, (_, i) => trace(10 + i)),
  ];
  const tiles = pickTiles(rows);
  expect(tiles.map(t => t.id).slice(0, 2)).toEqual(["t1", "t5"]);
  expect(tiles[1].photoId).toBe("early");
  expect(tiles).toHaveLength(10);
  expect(tiles.some(t => ["t2", "t3", "t4"].includes(t.id))).toBe(false);
  expect(JSON.stringify(tiles)).not.toMatch(/Private Person|latitude|longitude/);
  expect(pickTiles("not a list")).toEqual([]);
});

it("shows the recent traces strip with a hidden duplicate for the drift", async () => {
  visibleObserver();
  api.getData.mockImplementation(async path => path.startsWith("traces") ? [1, 2, 3, 4, 5].map(n => trace(n)) : { url: `https://img.test/${path}` });
  const { container } = render(<MemoryRouter><RecentTraces reduced={false} href="/register" label="Join to see the full archive" /></MemoryRouter>);
  await waitFor(() => expect(container.querySelectorAll(".tt-trace:not(.sk)")).toHaveLength(10));
  expect(screen.getByRole("heading", { name: "Recent traces from the community" })).toBeTruthy();
  expect(screen.getAllByRole("img")).toHaveLength(5);
  expect(container.querySelectorAll(".tt-trace-clone[aria-hidden='true']")).toHaveLength(5);
  expect(screen.getByRole("link", { name: "Join to see the full archive" }).getAttribute("href")).toBe("/register");
  expect(screen.queryByRole("button", { name: /motion/ })).toBeNull();
});

it("uses a still, scrollable row and no duplicates under reduced motion", async () => {
  visibleObserver(); matchMedia(true);
  api.getData.mockImplementation(async path => path.startsWith("traces") ? [1, 2, 3, 4].map(n => trace(n)) : { url: "https://img.test/x" });
  const { container } = render(<MemoryRouter><RecentTraces reduced href="/user/traces" label="Browse the full archive" /></MemoryRouter>);
  await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(4));
  expect(container.querySelector(".tt-trace-rail").className).toContain("is-static");
  expect(container.querySelectorAll(".tt-trace-clone")).toHaveLength(0);
  expect(screen.queryByRole("button", { name: /motion/ })).toBeNull();
});

it("keeps the strip still on small and touch screens", async () => {
  visibleObserver();
  vi.stubGlobal("matchMedia", vi.fn(query => ({ matches: query === "(max-width: 768px), (hover: none)", media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  api.getData.mockImplementation(async path => path.startsWith("traces") ? [1, 2, 3, 4].map(n => trace(n)) : { url: "https://img.test/x" });
  const { container } = render(<MemoryRouter><RecentTraces reduced={false} href="/register" label="Join" /></MemoryRouter>);
  await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(4));
  expect(container.querySelector(".tt-trace-rail").className).toContain("is-static");
  expect(container.querySelectorAll(".tt-trace-clone")).toHaveLength(0);
  expect(screen.queryByRole("button", { name: /motion/ })).toBeNull();
});

it("renders nothing when there are too few photos, the request fails, or data saver is on", async () => {
  visibleObserver();
  api.getData.mockImplementation(async path => path.startsWith("traces") ? [trace(1), trace(2)] : { url: "https://img.test/x" });
  const few = render(<MemoryRouter><RecentTraces reduced={false} href="/" label="x" /></MemoryRouter>);
  await waitFor(() => expect(few.container.querySelector("section")).toBeNull());
  few.unmount();
  api.getData.mockRejectedValue(new Error("down"));
  const failed = render(<MemoryRouter><RecentTraces reduced={false} href="/" label="x" /></MemoryRouter>);
  await waitFor(() => expect(failed.container.querySelector("section")).toBeNull());
  failed.unmount();
  Object.defineProperty(window.navigator, "connection", { configurable: true, value: { saveData: true } });
  try {
    api.getData.mockClear();
    const saver = render(<MemoryRouter><RecentTraces reduced={false} href="/" label="x" /></MemoryRouter>);
    expect(saver.container.querySelector("section")).toBeNull();
    expect(api.getData).not.toHaveBeenCalled();
  } finally { delete window.navigator.connection; }
});

it("counts up to the real total and keeps the final value for screen readers", async () => {
  visibleObserver();
  const community = { loading: false, data: { published_traces: 1234, contributors: 56, published_tides: 7, tides_completed: 89 } };
  const { container } = render(<CommunityTotals community={community} reduced={false} />);
  const first = container.querySelector(".tt-stat b");
  expect(within(first).getByText("1,234", { selector: ".sr-only" })).toBeTruthy();
  await waitFor(() => expect(first.querySelector("[aria-hidden='true']").textContent).toBe("1,234"), { timeout: 3000 });
});

it("shows plain totals when motion is reduced and a dash when there is no data", () => {
  const { container, rerender } = render(<CommunityTotals community={{ loading: false, data: { published_traces: 12, contributors: 4, published_tides: 3, tides_completed: 27 } }} reduced />);
  expect(container.querySelector(".tt-stat b").textContent).toBe("12");
  rerender(<CommunityTotals community={{ loading: false, data: null }} reduced={false} />);
  expect(container.querySelector(".tt-stat b").textContent).toContain("—");
});

it("draws the How it works connector once the steps are in view", () => {
  const callbacks = [];
  vi.stubGlobal("IntersectionObserver", class { constructor(cb) { callbacks.push(cb); } observe() {} unobserve() {} disconnect() {} });
  const { container } = render(<HowItWorks />);
  const grid = container.querySelector(".tt-sgrid3");
  expect(container.querySelectorAll(".tt-step")).toHaveLength(3);
  expect(grid.className).not.toContain("is-drawn");
  act(() => callbacks[0]([{ target: grid, isIntersecting: true }]));
  expect(grid.className).toContain("is-drawn");
});

it("adds a shadow after scrolling and highlights the section being read", () => {
  const callbacks = [];
  vi.stubGlobal("IntersectionObserver", class { constructor(cb) { callbacks.push(cb); } observe() {} unobserve() {} disconnect() {} });
  const section = Object.assign(document.createElement("section"), { id: "home-features" });
  document.body.append(section);
  render(<MemoryRouter><PublicNavbar /></MemoryRouter>);
  const nav = screen.getByRole("navigation");
  expect(nav.className).not.toContain("is-scrolled");
  Object.defineProperty(window, "scrollY", { configurable: true, value: 120 });
  act(() => { window.dispatchEvent(new Event("scroll")); });
  expect(nav.className).toContain("is-scrolled");
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  act(() => callbacks[0]([{ target: section, isIntersecting: true }]));
  expect(within(nav).getByRole("link", { name: "Features" }).getAttribute("aria-current")).toBe("location");
  expect(within(nav).getByRole("link", { name: "Impact" }).getAttribute("aria-current")).toBeNull();
  act(() => callbacks[0]([{ target: section, isIntersecting: false }]));
  expect(within(nav).getByRole("link", { name: "Features" }).getAttribute("aria-current")).toBeNull();
  section.remove();
});
