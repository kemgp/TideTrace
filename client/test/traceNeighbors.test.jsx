import React from "react";
import { expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import TraceNeighbors, { TraceStepper } from "../src/components/TraceNeighbors.jsx";

const both = { data: { newer: { id: "b", title: "New" }, older: { id: "c", title: "Old" } }, loading: false, error: "" };
function Where() { const location = useLocation(); return <output>{JSON.stringify(location.state)}</output>; }
const open = (ui) => render(<MemoryRouter initialEntries={["/user/traces/a"]}>{ui}<Where /></MemoryRouter>);

it("steps to the newer and older trace from the top buttons and keeps the archive state", () => {
  open(<TraceStepper neighbors={both} archiveSearch="?page=2" />);
  const newer = screen.getByRole("link", { name: "Newer trace: New" });
  expect(newer.getAttribute("href")).toBe("/user/traces/b");
  expect(newer.getAttribute("title")).toBe("New");
  expect(screen.getByRole("link", { name: "Older trace: Old" }).getAttribute("href")).toBe("/user/traces/c");
  fireEvent.click(newer);
  expect(screen.getByText('{"archiveSearch":"?page=2"}')).toBeTruthy();
});

it("keeps both button positions when only one neighbour exists", () => {
  const { container } = open(<TraceStepper neighbors={{ data: { newer: null, older: { id: "c", title: "Old" } }, loading: false, error: "" }} archiveSearch="" />);
  expect(screen.getByRole("link", { name: "Older trace: Old" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: /Newer/ })).toBeNull();
  const buttons = container.querySelectorAll(".trace-stepper__btn");
  expect(buttons).toHaveLength(2);
  expect(buttons[0].classList.contains("is-disabled")).toBe(true);
  expect(buttons[0].getAttribute("aria-hidden")).toBe("true");
});

it("reserves the two buttons while loading without exposing links", () => {
  const { container } = open(<TraceStepper neighbors={{ data: null, loading: true, error: "" }} archiveSearch="" />);
  expect(container.querySelectorAll(".trace-stepper__btn.is-disabled")).toHaveLength(2);
  expect(screen.queryAllByRole("link")).toHaveLength(0);
});

it.each([
  ["failed", { data: null, loading: false, error: "Failed" }],
  ["empty", { data: { newer: null, older: null }, loading: false, error: "" }],
])("shows no buttons or cards when neighbours are %s", (_name, neighbors) => {
  open(<><TraceStepper neighbors={neighbors} archiveSearch="" /><TraceNeighbors neighbors={neighbors} archiveSearch="" /></>);
  expect(screen.queryByRole("navigation")).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
});

it("shows the end-of-page cards only after loading, with titles and hrefs", () => {
  const { rerender } = open(<TraceNeighbors neighbors={{ data: null, loading: true, error: "" }} archiveSearch="" />);
  expect(screen.queryByRole("navigation")).toBeNull();
  rerender(<MemoryRouter initialEntries={["/user/traces/a"]}><TraceNeighbors neighbors={both} archiveSearch="" /><Where /></MemoryRouter>);
  expect(screen.getByRole("link", { name: /Newer trace New/ }).getAttribute("href")).toBe("/user/traces/b");
  expect(screen.getByRole("link", { name: /Older trace Old/ }).getAttribute("href")).toBe("/user/traces/c");
  expect(screen.getByTitle("New")).toBeTruthy();
});
