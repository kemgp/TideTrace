import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "./router.jsx";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";
import { shortDate } from "../src/api/relativeTime.js";

const admin = { id: "admin", display_name: "Admin", role: "admin", status: "active" };
const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const refused = (message = "Not saved.") => ({ ok: false, status: 400, json: async () => ({ error: { code: "INVALID_DATA", message } }) });
const never = { active: false, activated_at: null, updated_at: null, updated_by_name: null };
const on = { active: true, activated_at: "2026-11-10T12:00:00Z", updated_at: "2026-11-10T12:00:00Z", updated_by_name: "Ana Admin" };
const paused = { active: false, activated_at: null, updated_at: "2026-11-11T12:00:00Z", updated_by_name: "Ana Admin" };
const defaultPut = ({ active }) => ok(active ? { ...on, updated_by_name: "Admin" } : { ...paused, updated_by_name: "Admin" });

beforeEach(() => {
  // jsdom does not implement the native modal's top layer or focus handling.
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value: function () { this.open = true; } },
    close: { configurable: true, value: function () { this.open = false; } },
  });
});
afterEach(() => vi.unstubAllEnvs());

function setup(initial, put = defaultPut) {
  let current = initial;
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "access", refresh_token: "refresh", expires_at: Date.now() / 1000 + 3600 }));
  const calls = vi.fn(async (url, options = {}) => {
    if (url === "/api/auth/me") return ok(admin);
    if (url === "/api/admin/energy-settings") {
      if (options.method === "PUT") {
        const response = put(JSON.parse(options.body));
        if (response.ok) current = (await response.json()).data;
        return response;
      }
      return ok(current);
    }
    return ok([]);
  });
  vi.stubGlobal("fetch", calls);
  render(<MemoryRouter initialEntries={["/admin/settings?tab=energy"]}><App /></MemoryRouter>);
  return calls;
}
const puts = (calls) => calls.mock.calls.filter(([, options]) => options?.method === "PUT");
const gets = (calls) => calls.mock.calls.filter(([url, options]) => url === "/api/admin/energy-settings" && (!options?.method || options.method === "GET"));
// The value shown next to a label in the status list.
const valueOf = (label) => screen.getByText(label).nextElementSibling.textContent;

it("hides Tide Energy while the build flag is off", async () => {
  const calls = setup(never);
  expect(await screen.findByText("Moderation rules")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Tide Energy" })).toBeNull();
  expect(calls.mock.calls.some(([url]) => url === "/api/admin/energy-settings")).toBe(false);
});

it("shows Tide Energy as its own settings section when the flag is on", async () => {
  vi.stubEnv("VITE_ENERGY_ENABLED", "true");
  setup(never);
  expect(await screen.findByText("Not turned on yet")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Tide Energy" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("heading", { name: "Tide Energy" })).toBeTruthy();
});

it("asks before activating, then reports who turned it on and since when", async () => {
  vi.stubEnv("VITE_ENERGY_ENABLED", "true");
  const calls = setup(never);
  fireEvent.click(await screen.findByRole("button", { name: "Activate Tide Energy" }));
  let dialog = await screen.findByRole("dialog", { name: "Activate Tide Energy?" });
  expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(within(dialog).getByText(/before now do not count/)).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(puts(calls)).toHaveLength(0);

  fireEvent.click(screen.getByRole("button", { name: "Activate Tide Energy" }));
  dialog = await screen.findByRole("dialog", { name: "Activate Tide Energy?" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Activate" }));
  expect(await screen.findByText("Tide Energy is on. Awards start now.")).toBeTruthy();
  expect(puts(calls)).toHaveLength(1);
  expect(JSON.parse(puts(calls)[0][1].body)).toEqual({ active: true });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(valueOf("Status")).toBe("On");
  expect(valueOf("Awarding since")).toBe(shortDate(on.activated_at));
  expect(valueOf("Turned on by")).toBe("Admin");
  expect(screen.getByRole("button", { name: "Pause awards" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Activate Tide Energy" })).toBeNull();
});

it("asks before pausing and shows the pause", async () => {
  vi.stubEnv("VITE_ENERGY_ENABLED", "true");
  const calls = setup(on);
  expect(await screen.findByText("Awarding since")).toBeTruthy();
  expect(valueOf("Turned on by")).toBe("Ana Admin");
  fireEvent.click(screen.getByRole("button", { name: "Pause awards" }));
  const dialog = await screen.findByRole("dialog", { name: "Pause awards?" });
  expect(within(dialog).getByText(/Balances stay as they are/)).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: "Pause awards" }));
  expect(await screen.findByText("Awards are paused.")).toBeTruthy();
  expect(JSON.parse(puts(calls)[0][1].body)).toEqual({ active: false });
  expect(valueOf("Status")).toBe("Paused");
  expect(valueOf("Paused on")).toBe(shortDate(paused.updated_at));
  expect(valueOf("Paused by")).toBe("Admin");
  expect(screen.getByRole("button", { name: "Activate Tide Energy" })).toBeTruthy();
});

it("closes the question with Escape unless a save is running", async () => {
  vi.stubEnv("VITE_ENERGY_ENABLED", "true");
  const calls = setup(never);
  fireEvent.click(await screen.findByRole("button", { name: "Activate Tide Energy" }));
  const dialog = await screen.findByRole("dialog");
  fireEvent(dialog, new Event("cancel", { bubbles: true, cancelable: true }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(puts(calls)).toHaveLength(0);
});

it("keeps the old status and blocks more changes after a refused save until reloaded", async () => {
  vi.stubEnv("VITE_ENERGY_ENABLED", "true");
  const calls = setup(never, () => refused("Energy can only be activated from the current time."));
  fireEvent.click(await screen.findByRole("button", { name: "Activate Tide Energy" }));
  fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Activate" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toBe("Energy can only be activated from the current time. Reload the status before trying again.");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByText("Not turned on yet")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Activate Tide Energy" }).disabled).toBe(true);
  expect(puts(calls)).toHaveLength(1);

  const before = gets(calls).length;
  fireEvent.click(screen.getByRole("button", { name: "Reload status" }));
  // The panel is replaced while the saved status loads again, so its blocked state and error are gone.
  const again = await screen.findByRole("button", { name: "Activate Tide Energy" });
  expect(gets(calls).length).toBe(before + 1);
  expect(again.disabled).toBe(false);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByRole("button", { name: "Reload status" })).toBeNull();
});

it("does not trust a save the server answers with the wrong status", async () => {
  vi.stubEnv("VITE_ENERGY_ENABLED", "true");
  setup(never, () => ok(never));
  fireEvent.click(await screen.findByRole("button", { name: "Activate Tide Energy" }));
  fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Activate" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Could not verify the saved status. Reload the status before trying again.");
  expect(screen.queryByText("Tide Energy is on. Awards start now.")).toBeNull();
});
