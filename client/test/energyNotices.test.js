import { expect, it } from "vitest";
import { energyNotice } from "../src/hooks/useEnergyNotices.js";

it("reads energy out of approval and reversal notices only", () => {
  expect(energyNotice({ type: "trace_review", message: 'Your Trace "A": approved. You earned 20 Tide Energy.' })).toEqual({ message: "You earned 20 Tide Energy for a Trace.", type: "success" });
  expect(energyNotice({ type: "trace_review", message: 'Your Trace "A": approved.' })).toBeNull();
  expect(energyNotice({ type: "trace_review", message: 'Your Trace "A": rejected. Not clear.' })).toBeNull();
  expect(energyNotice({ type: "energy_reversal", message: "An admin reversed 15 Tide Energy for a lesson quiz. Reason: x" })).toEqual({ message: "An admin reversed 15 Tide Energy.", type: "info" });
  expect(energyNotice({ type: "energy_flag", message: "New energy flag to review" })).toBeNull();
  expect(energyNotice(null)).toBeNull();
});
