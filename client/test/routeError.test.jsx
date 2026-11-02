import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import RouteError from "../src/components/RouteError.jsx";

function Crash() { throw new Error("Rendered more hooks than during the previous render."); }
const show = (route) => render(<RouterProvider router={createMemoryRouter([{ path: "*", errorElement: <RouteError />, ...route }])} />);
afterEach(() => vi.restoreAllMocks());

it("replaces the developer error screen with a plain recovery page", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  show({ element: <Crash /> });
  const heading = await screen.findByRole("heading", { level: 1, name: "Something went wrong" });
  expect(document.activeElement).toBe(heading);
  expect(screen.getByRole("button", { name: "Reload page" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Go to home" }).getAttribute("href")).toBe("/");
  expect(screen.queryByText(/Hey developer/)).toBeNull();
});

it("explains a missing page and offers only the way home", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  show({ loader: () => { throw new Response("", { status: 404 }); }, element: <div /> });
  expect(await screen.findByRole("heading", { level: 1, name: "Page not found" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Reload page" })).toBeNull();
  expect(screen.getByRole("link", { name: "Go to home" }).getAttribute("href")).toBe("/");
});
