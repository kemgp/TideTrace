import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";
import RemoteState from "../src/components/RemoteState.jsx";

it.each([
  ["/user/traces", "cards"],
  ["/user/traces/trace-id", "detail"],
  ["/user/notifications", "notifications"],
  ["/moderator/comments", "comments"],
  ["/moderator/reports", "reports"],
  ["/admin/tides", "admincontent"],
])("uses the original %s skeleton until the request settles", (path, type) => {
  const view = loading => <MemoryRouter initialEntries={[path]}><RemoteState loading={loading} /></MemoryRouter>;
  const { rerender } = render(view(true));
  expect(screen.getByRole("status", { name: "Loading content" }).dataset.skeletonType).toBe(type);
  expect(screen.queryByText("Loading…")).toBeNull();
  rerender(view(false));
  expect(screen.queryByRole("status", { name: "Loading content" })).toBeNull();
});
it("keeps nested loading sections compact instead of repeating a whole page", () => {
  render(<MemoryRouter initialEntries={["/user/traces/trace-id"]}><RemoteState compact loading /></MemoryRouter>);
  expect(screen.getByRole("status", { name: "Loading content" }).className).toBe("remote-skeleton");
});
