import React from "react";
import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import TraceNeighbors from "../src/components/TraceNeighbors.jsx";
const api = vi.hoisted(() => ({ readData: vi.fn(), profile: { id: "me" } }));
vi.mock("../src/context/AppContext.jsx", () => ({ useApp: () => api }));
function Page() {
  const location = useLocation();
  return <><output>{JSON.stringify(location.state)}</output><TraceNeighbors key={location.pathname} traceId={location.pathname.split("/").at(-1)} archiveSearch="?page=2" /></>;
}
const open = () => render(<MemoryRouter initialEntries={["/user/traces/a"]}><Page /></MemoryRouter>);
it("renders links with titles, preserves state, and refetches on navigation", async () => {
  api.readData.mockImplementation(async (path) => path.includes("/a/") ? { newer: { id: "b", title: "New" }, older: { id: "c", title: "Old" } } : { newer: null, older: null });
  open();
  const link = await screen.findByRole("link", { name: /Newer trace New/ });
  expect(link.getAttribute("href")).toBe("/user/traces/b");
  expect(screen.getByTitle("New")).toBeTruthy();
  expect(screen.getByRole("link", { name: /Older trace Old/ }).getAttribute("href")).toBe("/user/traces/c");
  fireEvent.click(link);
  await waitFor(() => expect(api.readData).toHaveBeenCalledWith("traces/b/neighbors", expect.anything()));
  expect(screen.getByText('{"archiveSearch":"?page=2"}')).toBeTruthy();
});
it("renders older alone", async () => {
  api.readData.mockResolvedValue({ newer: null, older: { id: "c", title: "Old" } }); open();
  await screen.findByRole("link", { name: /Older trace/ });
  expect(screen.queryByText("Newer trace")).toBeNull();
});
it.each([false, true])("silently omits empty or failed neighbors (%s)", async (error) => {
  let complete = false;
  api.readData.mockImplementation(async () => { complete = true; if (error) throw new Error("Failed"); return { newer: null, older: null }; }); open();
  await waitFor(() => expect(complete).toBe(true));
  expect(screen.queryByRole("navigation")).toBeNull(); expect(screen.queryByRole("alert")).toBeNull();
});
