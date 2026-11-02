import React from "react";
import { expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RelatedTraces from "../src/components/RelatedTraces.jsx";
const api = vi.hoisted(() => ({ readData: vi.fn(), profile: { id: "me", data_saver: true } }));
vi.mock("../src/context/AppContext.jsx", () => ({ useApp: () => api }));
const open = () => render(<MemoryRouter><RelatedTraces traceId="current" category="Pollution" archiveSearch="?page=2" /></MemoryRouter>);
it("shows at most three cards with detail links and excludes the current trace", async () => {
  api.readData.mockResolvedValue(["current", "a", "b", "c", "d"].map((id) => ({ id, title: `Trace ${id}`, status: "approved" }))); open();
  await screen.findByRole("heading", { name: "More in Pollution" });
  await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(3));
  expect(screen.queryByText("Trace current")).toBeNull(); expect(screen.queryByText("Trace d")).toBeNull();
  expect(screen.getByRole("link", { name: /Trace a/ }).getAttribute("href")).toBe("/user/traces/a");
});
it.each([false, true])("omits empty or failed related content without alerts (%s)", async (error) => {
  api.readData.mockImplementation(async () => { if (error) throw new Error("Failed"); return []; }); open();
  await waitFor(() => expect(screen.queryByRole("heading")).toBeNull()); expect(screen.queryByRole("alert")).toBeNull();
});
it("shows nothing while loading, so no space is reserved and later removed", () => {
  api.readData.mockImplementation(() => new Promise(() => {})); open();
  expect(screen.queryByRole("heading")).toBeNull();
  expect(document.querySelector(".trace-related")).toBeNull();
});
it("falls back to a generic heading without a category name", async () => {
  api.readData.mockResolvedValue([{ id: "a", title: "Trace a", status: "approved" }]);
  render(<MemoryRouter><RelatedTraces traceId="current" archiveSearch="" /></MemoryRouter>);
  await screen.findByRole("heading", { name: "More from this category" });
});
