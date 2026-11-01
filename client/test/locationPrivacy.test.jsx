import React from "react";
import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TraceLocationPrivacy from "../src/components/TraceLocationPrivacy.jsx";
import { useApp } from "../src/context/AppContext.jsx";
vi.mock("../src/context/AppContext.jsx", () => ({ useApp: vi.fn() }));
const trace = { id: "trace-1", version: 2, is_sensitive: false, latitude: 10, longitude: 124 };
it("hides a pin with its saved version and preserves private coordinates in the owner view", async () => {
  const saved = { ...trace, is_sensitive: true, version: 3 };
  const writeData = vi.fn().mockResolvedValue(saved); const onChange = vi.fn();
  useApp.mockReturnValue({ writeData });
  render(<TraceLocationPrivacy trace={trace} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Hide exact location" }));
  await waitFor(() => expect(onChange).toHaveBeenCalledWith(saved));
  expect(writeData).toHaveBeenCalledWith("traces/trace-1/hide-location", { method: "POST", body: { version: 2 } });
});
it("blocks another write after an uncertain response until the saved Trace is reloaded", async () => {
  const writeData = vi.fn().mockRejectedValue(new Error("Connection lost")); const onChange = vi.fn();
  useApp.mockReturnValue({ writeData });
  render(<TraceLocationPrivacy trace={trace} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Hide exact location" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Hide exact location" }).disabled).toBe(true);
  expect(onChange).not.toHaveBeenCalled();
});
