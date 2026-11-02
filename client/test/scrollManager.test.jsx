import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { MemoryRouter, Link, useNavigate } from "react-router-dom";
import ScrollManager from "../src/components/ScrollManager.jsx";

let navigate;
function Nav() { navigate = useNavigate(); return <Link to="/next">next</Link>; }
function setup() {
  render(<MemoryRouter initialEntries={["/start"]}><ScrollManager /><Nav /></MemoryRouter>);
}
beforeEach(() => { document.documentElement.scrollTop = 0; sessionStorage.clear(); });
afterEach(() => vi.restoreAllMocks());

it("starts a newly opened page at the top", () => {
  setup();
  document.documentElement.scrollTop = 400;
  act(() => navigate("/next"));
  expect(document.documentElement.scrollTop).toBe(0);
});

it("does not move the page when the URL is replaced in place", () => {
  setup();
  document.documentElement.scrollTop = 400;
  act(() => navigate("/start?q=reef", { replace: true }));
  expect(document.documentElement.scrollTop).toBe(400);
});
