import React from "react";
import { expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RelatedTraces from "../src/components/RelatedTraces.jsx";
const api = vi.hoisted(() => ({ readData: vi.fn(), profile: { id: "me", data_saver: true } }));
vi.mock("../src/context/AppContext.jsx", () => ({ useApp: () => api }));
const open = () => render(<MemoryRouter><RelatedTraces traceId="current" archiveSearch="?page=2" /></MemoryRouter>);
it("shows at most three cards with detail links and excludes the current trace", async () => {
  api.readData.mockResolvedValue(["current", "a", "b", "c", "d"].map((id) => ({ id, title: `Trace ${id}`, status: "approved" }))); open();
  await screen.findByRole("heading", { name: "More from this category" });
  await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(3));
  expect(screen.queryByText("Trace current")).toBeNull(); expect(screen.queryByText("Trace d")).toBeNull();
  expect(screen.getByRole("link", { name: /Trace a/ }).getAttribute("href")).toBe("/user/traces/a");
});
it.each([false, true])("omits empty or failed related content without alerts (%s)", async (error) => {
  api.readData.mockImplementation(async () => { if (error) throw new Error("Failed"); return []; }); open();
  await waitFor(() => expect(screen.queryByRole("heading")).toBeNull()); expect(screen.queryByRole("alert")).toBeNull();
});
it("reserves three skeleton cards while loading", () => {
  api.readData.mockImplementation(() => new Promise(() => {})); open();
  expect(document.querySelectorAll(".trace-related__skeleton")).toHaveLength(3);
});
