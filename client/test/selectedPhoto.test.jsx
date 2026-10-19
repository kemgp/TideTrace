import React, { StrictMode } from "react";
import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import SelectedPhoto from "../src/components/SelectedPhoto.jsx";

it("revokes each replaced or unmounted preview without invalidating the current photo in StrictMode", () => {
  const first = new File(["first"], "first.png", { type: "image/png" });
  const second = new File(["second"], "second.png", { type: "image/png" });
  const view = render(<StrictMode><SelectedPhoto file={first} /></StrictMode>);
  const firstURL = screen.getByRole("img", { name: "Selected photo preview" }).getAttribute("src");
  expect(URL.createObjectURL).toHaveBeenCalledWith(first);
  expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(firstURL);
  view.rerender(<StrictMode><SelectedPhoto file={second} /></StrictMode>);
  const secondURL = screen.getByRole("img", { name: "Selected photo preview" }).getAttribute("src");
  expect(secondURL).not.toBe(firstURL);
  expect(URL.createObjectURL).toHaveBeenCalledWith(second);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith(firstURL);
  expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(secondURL);
  view.unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith(secondURL);
  expect(URL.revokeObjectURL.mock.calls.map(([url]) => url).sort()).toEqual(URL.createObjectURL.mock.results.map(({ value }) => value).sort());
});
