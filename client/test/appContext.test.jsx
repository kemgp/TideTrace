import React, { StrictMode } from "react";
import { expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { AppProvider, useApp } from "../src/context/AppContext.jsx";

function ToastControls() {
  const { toast, showToast } = useApp();
  return <><output role="status">{toast}</output>
    <button onClick={() => showToast("First notice")}>First toast</button>
    <button onClick={() => showToast("Second notice")}>Second toast</button></>;
}

it("replaces the toast expiry and clears provider timers when unmounted", async () => {
  vi.useFakeTimers();
  const view = render(<StrictMode><AppProvider><ToastControls /></AppProvider></StrictMode>);
  // Finish the empty-session restoration before measuring provider timers.
  await act(async () => {});
  const idleTimers = vi.getTimerCount();
  fireEvent.click(screen.getByRole("button", { name: "First toast" }));
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  fireEvent.click(screen.getByRole("button", { name: "Second toast" }));
  expect(vi.getTimerCount()).toBe(idleTimers + 1);
  await act(async () => { await vi.advanceTimersByTimeAsync(600); });
  expect(screen.getByRole("status").textContent).toBe("Second notice");
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
