import React from "react";
import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import PublicNavbar from "../src/components/home/PublicNavbar.jsx";

vi.mock("../src/context/AppContext.jsx", () => ({ useApp: () => ({ role: null }) }));
function Page() {
  const { pathname } = useLocation();
  return <><PublicNavbar /><output data-testid="path">{pathname}</output></>;
}

it("preserves public link markup across login and signup and closes the mobile menu", () => {
  render(<MemoryRouter><Page /></MemoryRouter>);
  const nav = screen.getByRole("navigation");
  const links = ["Our Mission", "Features", "Impact", "How it Works"];
  const initialLinks = links.map(name => within(nav).getByRole("link", { name }));
  const initialClass = nav.className;
  expect(initialLinks[0].getAttribute("href")).toBe("#home-mission");
  fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
  fireEvent.click(within(nav).getByRole("link", { name: "Log in" }));
  expect(screen.getByTestId("path").textContent).toBe("/login");
  expect(screen.getByRole("button", { name: "Open menu" }).getAttribute("aria-expanded")).toBe("false");
  expect(screen.getByRole("navigation").className).toBe(initialClass);
  links.forEach((name, index) => expect(within(nav).getByRole("link", { name })).toBe(initialLinks[index]));
  expect(initialLinks[0].getAttribute("href")).toBe("/#home-mission");
  fireEvent.click(within(nav).getByRole("link", { name: "Join TideTrace" }));
  expect(screen.getByTestId("path").textContent).toBe("/register");
  expect(screen.getByRole("navigation").className).toBe(initialClass);
});
