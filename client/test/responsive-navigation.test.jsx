import React from "react";
import { expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Navbar from "../src/components/Navbar.jsx";

const { appState } = vi.hoisted(() => ({ appState: { role: null, profile: null, logout: vi.fn(), unreadNotificationCount: 0 } }));
vi.mock("../src/context/AppContext.jsx", () => ({ useApp: () => appState }));
function open(role = null) {
  appState.role = role;
  appState.profile = role ? { display_name: "A very long community member name" } : null;
  return render(<MemoryRouter initialEntries={[role ? `/${role === "mod" ? "moderator" : role}/dashboard` : "/"]}><Navbar /></MemoryRouter>);
}

it.each([null, "user", "mod", "admin"])("opens and dismisses the %s navigation with the keyboard", (role) => {
  open(role);
  const toggle = screen.getByRole("button", { name: "Menu" });
  expect(toggle.getAttribute("aria-controls")).toBe("main-navigation-panel");
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(toggle);
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(toggle);
});

it("closes the panel after navigating and preserves the account actions", () => {
  open("user");
  const toggle = screen.getByRole("button", { name: "Menu" });
  fireEvent.click(toggle);
  fireEvent.click(screen.getByRole("link", { name: "Traces" }));
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(screen.getByRole("link", { name: "Traces" }).getAttribute("aria-current")).toBe("page");
  fireEvent.click(toggle);
  fireEvent.click(screen.getByRole("button", { name: "Change profile" }));
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(screen.getByRole("button", { name: "Log out" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Profile settings" })).toBeTruthy();
});

it("closes when clicking outside, but leaves clicks within the panel alone", () => {
  open("admin");
  const toggle = screen.getByRole("button", { name: "Menu" });
  fireEvent.click(toggle);
  fireEvent.pointerDown(document.getElementById("main-navigation-panel"));
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  fireEvent.pointerDown(document.body);
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
});

it("resets the disclosure after crossing the desktop breakpoint", () => {
  let change;
  const media = { matches: false, addEventListener: vi.fn((event, handler) => { change = handler; }), removeEventListener: vi.fn() };
  vi.stubGlobal("matchMedia", vi.fn(() => media));
  const view = open("mod");
  const toggle = screen.getByRole("button", { name: "Menu" });
  fireEvent.click(toggle);
  media.matches = true;
  act(() => change());
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  view.unmount();
  expect(media.removeEventListener).toHaveBeenCalledWith("change", change);
});
