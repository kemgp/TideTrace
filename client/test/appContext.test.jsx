import React, { StrictMode } from "react";
import { expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { AppProvider, useApp } from "../src/context/AppContext.jsx";
import Toasts from "../src/components/Toasts.jsx";

function ToastControls() {
  const { showToast } = useApp();
  return <><Toasts />
    <button onClick={() => showToast("First notice")}>First toast</button>
    <button onClick={() => showToast("Second notice")}>Second toast</button></>;
}

it("stacks toasts, expires each on its own and clears provider timers when unmounted", async () => {
  vi.useFakeTimers();
  const view = render(<StrictMode><AppProvider><ToastControls /></AppProvider></StrictMode>);
  // Finish the empty-session restoration before measuring provider timers.
  await act(async () => {});
  const idleTimers = vi.getTimerCount();
  fireEvent.click(screen.getByRole("button", { name: "First toast" }));
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  fireEvent.click(screen.getByRole("button", { name: "Second toast" }));
  expect(vi.getTimerCount()).toBe(idleTimers + 2);
  expect(screen.getByText("First notice")).toBeTruthy();
  expect(screen.getByText("Second notice")).toBeTruthy();
  await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
  expect(screen.queryByText("First notice")).toBeNull();
  expect(screen.getByText("Second notice")).toBeTruthy();
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
