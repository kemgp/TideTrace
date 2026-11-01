import React from "react";
import { expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { AppProvider, useApp } from "../src/context/AppContext.jsx";
import Toasts from "../src/components/Toasts.jsx";
import useToast from "../src/hooks/useToast.js";

function Controls() {
  const { showToast } = useApp();
  const toast = useToast();
  return <><Toasts />
    <button onClick={() => showToast("Saved the plain way")}>plain</button>
    <button onClick={() => toast.success("Profile saved")}>success</button>
    <button onClick={() => toast.info("Heads up")}>info</button>
    <button onClick={() => toast.error("Could not reach the server")}>error</button>
    <button onClick={() => toast.success("Draft saved", { action: { label: "View", onClick: () => window.__viewed = true } })}>action</button>
    <button onClick={() => { ["one", "two", "three", "four"].forEach(message => toast.info(message)); }}>many</button></>;
}
async function setup() {
  vi.useFakeTimers();
  const view = render(<AppProvider><Controls /></AppProvider>);
  await act(async () => {});
  return view;
}
const press = name => fireEvent.click(screen.getByRole("button", { name }));
const polite = () => document.querySelector(".toast-stack[aria-live='polite']");
const assertive = () => document.querySelector(".toast-stack[aria-live='assertive']");

it("keeps both live regions on the page and files each message in the right one", async () => {
  await setup();
  expect(polite()).toBeTruthy();
  expect(assertive()).toBeTruthy();
  press("plain");
  press("error");
  expect(within(polite()).getByText("Saved the plain way")).toBeTruthy();
  expect(within(assertive()).getByText("Could not reach the server")).toBeTruthy();
  expect(polite().textContent).not.toContain("Could not reach");
});

it("expires success and info messages but keeps errors until they are dismissed", async () => {
  await setup();
  press("success"); press("info"); press("error");
  await act(async () => { await vi.advanceTimersByTimeAsync(6500); });
  expect(screen.queryByText("Profile saved")).toBeNull();
  expect(screen.queryByText("Heads up")).toBeNull();
  expect(screen.getByText("Could not reach the server")).toBeTruthy();
  await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
  expect(screen.getByText("Could not reach the server")).toBeTruthy();
  fireEvent.click(within(assertive()).getByRole("button", { name: "Dismiss notification" }));
  expect(screen.queryByText("Could not reach the server")).toBeNull();
});

it("shows the same message once, and at most three at a time (oldest dropped)", async () => {
  await setup();
  press("success"); press("success");
  expect(screen.getAllByText("Profile saved")).toHaveLength(1);
  press("many");
  expect(document.querySelectorAll(".toast-item")).toHaveLength(3);
  expect(screen.queryByText("Profile saved")).toBeNull();
  expect(screen.queryByText("one")).toBeNull();
  expect(screen.getByText("four")).toBeTruthy();
});

it("pauses the countdown while hovered or focused and resumes afterwards", async () => {
  await setup();
  press("success");
  const item = screen.getByText("Profile saved").closest(".toast-item");
  await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
  fireEvent.mouseEnter(item);
  await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
  expect(screen.getByText("Profile saved")).toBeTruthy();
  fireEvent.mouseLeave(item);
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(screen.queryByText("Profile saved")).toBeNull();
});

it("closes with the button or Escape and runs an optional action once", async () => {
  await setup();
  press("success");
  fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
  expect(screen.queryByText("Profile saved")).toBeNull();
  press("info");
  fireEvent.keyDown(screen.getByText("Heads up").closest(".toast-item"), { key: "Escape" });
  expect(screen.queryByText("Heads up")).toBeNull();
  press("action");
  fireEvent.click(screen.getByRole("button", { name: "View" }));
  expect(window.__viewed).toBe(true);
  expect(screen.queryByText("Draft saved")).toBeNull();
  delete window.__viewed;
});

it("ignores empty messages", async () => {
  vi.useFakeTimers();
  function Empty() { const { showToast } = useApp(); return <><Toasts /><button onClick={() => showToast("   ")}>blank</button></>; }
  render(<AppProvider><Empty /></AppProvider>);
  await act(async () => {});
  press("blank");
  expect(document.querySelectorAll(".toast-item")).toHaveLength(0);
});
