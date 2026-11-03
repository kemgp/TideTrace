import React, { StrictMode } from "react";
import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useLocation, useNavigate } from "react-router-dom";
import { MemoryRouter } from "./router.jsx";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";
const category = "30000000-0000-4000-8000-000000000001";
const id = "20000000-0000-4000-8000-000000000001";
const trace = { id, author_id: "other", title: "Reef survey", status: "approved", trace_media: [], category: { id: category, name: "Reefs" } };
const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
function Location() {
  const location = useLocation(); const navigate = useNavigate();
  return <><output data-testid="url">{location.pathname}{location.search}</output><button onClick={() => navigate(-1)}>Browser back</button><button onClick={() => navigate(1)}>Browser forward</button></>;
}
function setup(search = "", rows = Array.from({ length: 6 }, (_, n) => ({ ...trace, id: n ? `trace-${n}` : id, title: n ? `Survey ${n}` : trace.title }))) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "access", refresh_token: "refresh", expires_at: Date.now() / 1000 + 3600 }));
  const fetch = vi.fn(async (url) => {
    if (url === "/api/auth/me") return ok({ id: "me", display_name: "Member", role: "user", status: "active", data_saver: true });
    if (url === "/api/categories") return ok([trace.category]);
    if (url.startsWith("/api/traces?")) return ok(rows);
    if (url === `/api/traces/${id}`) return ok(trace);
    return ok([]);
  });
  vi.stubGlobal("fetch", fetch);
  render(<StrictMode><MemoryRouter initialEntries={[search.startsWith("/user/") ? search : `/user/traces${search}`]}><Location /><App /></MemoryRouter></StrictMode>);
  return fetch;
}
const url = () => screen.getByTestId("url").textContent;
it("requests the bookmarked page, query and category", async () => {
  const fetch = setup(`?q=reef&category=${category}&page=2&view=list`);
  await screen.findByRole("link", { name: /Reef survey/ });
  expect(fetch.mock.calls.some(([path]) => path === `/api/traces?limit=6&offset=6&q=reef&category_id=${category}`)).toBe(true);
});
it("updates search and category and resets the page", async () => {
  setup("?page=2"); await screen.findByRole("link", { name: /Reef survey/ });
  fireEvent.change(screen.getByRole("textbox", { name: "Search traces" }), { target: { value: "reef" } });
  expect(url()).toBe("/user/traces?q=reef");
  await waitFor(() => expect(screen.getByRole("button", { name: "Next page" }).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Next page" })); expect(url()).toContain("page=2");
  fireEvent.change(screen.getByRole("combobox", { name: "Category" }), { target: { value: category } });
  expect(url()).toBe(`/user/traces?q=reef&category=${category}`);
});
it("restores the draft through browser Back and Forward", async () => {
  setup("?q=reef"); await screen.findByRole("link", { name: /Reef survey/ });
  fireEvent.click(screen.getByRole("button", { name: "Next page" })); expect(url()).toBe("/user/traces?q=reef&page=2");
  fireEvent.change(screen.getByRole("textbox", { name: "Search traces" }), { target: { value: "coast" } });
  fireEvent.click(screen.getByRole("button", { name: "Browser back" }));
  await waitFor(() => expect(screen.getByRole("textbox", { name: "Search traces" }).value).toBe("reef"));
  fireEvent.click(screen.getByRole("button", { name: "Browser forward" }));
  await waitFor(() => expect(screen.getByRole("textbox", { name: "Search traces" }).value).toBe("coast"));
});
it.each(["zzz", "30000000-0000-4000-8000-000000000099"])("ignores malformed or unavailable categories (%s)", async (value) => {
  const fetch = setup(`?page=abc&category=${value}`); await screen.findByRole("link", { name: /Reef survey/ });
  expect(fetch.mock.calls.some(([path]) => path === "/api/traces?limit=6&offset=0")).toBe(true);
  expect(screen.getByRole("combobox", { name: "Category" }).value).toBe("All");
});
it("returns from detail to the same archive state", async () => {
  const search = `?q=reef&category=${category}&page=2`; setup(search);
  fireEvent.click(await screen.findByRole("link", { name: /Reef survey/ }));
  await waitFor(() => expect(document.querySelector(".page-hero__back")).toBeTruthy()); fireEvent.click(screen.getByRole("link", { name: /Back to Traces/ })); expect(url()).toBe(`/user/traces${search}`);
});
it("uses plain archive for a directly opened trace", async () => {
  setup(`/user/traces/${id}`); await waitFor(() => expect(document.querySelector(".page-hero__back")).toBeTruthy()); fireEvent.click(screen.getByRole("link", { name: /Back to Traces/ })); expect(url()).toBe("/user/traces");
});
it("clears filters and replaces an out-of-range page", async () => {
  setup(`?q=reef&category=${category}&page=2`, []);
  const clear = await screen.findByRole("button", { name: "Clear filters" }); await waitFor(() => expect(url()).not.toContain("page="));
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" })); expect(url()).toBe("/user/traces");
});
it("says which filters are active and clears them from the results", async () => {
  setup(`?q=reef&category=${category}`); await screen.findByRole("link", { name: /Reef survey/ });
  expect(screen.getByText(/Showing results for “reef” in Reefs/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Clear all filters" }));
  expect(url()).toBe("/user/traces");
  expect(screen.queryByText(/Showing results/)).toBeNull();
});
it("does not show the active-filter line when nothing is filtered", async () => {
  setup(); await screen.findByRole("link", { name: /Reef survey/ });
  expect(screen.queryByText(/Showing results/)).toBeNull();
});

