import React from "react";
import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import PageHeader from "../src/components/PageHeader.jsx";

it("shows the eyebrow, title, subtitle and actions, with a decorative wave", () => {
  const { container } = render(<PageHeader back={<a href="/user/tides">Back to Tides</a>} eyebrow="Tides" title="Learn the sea" subtitle="Explore lessons." actions={<button type="button">Upload trace</button>}><p>Extra</p></PageHeader>);
  expect(screen.getByRole("heading", { level: 2, name: "Learn the sea" })).toBeTruthy();
  expect(screen.getByText("Tides")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Back to Tides" })).toBeTruthy();
  expect(screen.getByText("Explore lessons.")).toBeTruthy();
  expect(screen.getByText("Extra")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Upload trace" })).toBeTruthy();
  expect(container.querySelector(".page-hero__wave").getAttribute("aria-hidden")).toBe("true");
});

it("can use a different heading level and leaves out parts that are not given", () => {
  const { container } = render(<PageHeader as="h1" title="Settings" />);
  expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeTruthy();
  expect(container.querySelector(".page-hero__eyebrow")).toBeNull();
  expect(container.querySelector(".page-hero__sub")).toBeNull();
  expect(container.querySelector(".page-hero__actions")).toBeNull();
});
