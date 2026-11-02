import { expect, it } from "vitest";
import { fullDate, relativeTime } from "../src/api/relativeTime.js";

const now = Date.parse("2026-11-02T00:00:00Z");

it("describes recent and older times in plain words", () => {
  expect(relativeTime("2026-11-02T00:00:00Z", now)).toBe("just now");
  expect(relativeTime("2026-10-30T00:00:00Z", now)).toBe("3 days ago");
  expect(relativeTime("2026-11-01T22:00:00Z", now)).toBe("2 hours ago");
  expect(relativeTime("2026-10-02T00:00:00Z", now)).toBe("last month");
});

it("returns nothing for missing or invalid dates", () => {
  expect(relativeTime("", now)).toBe("");
  expect(relativeTime("not a date", now)).toBe("");
  expect(fullDate("not a date")).toBe("");
  expect(fullDate("2026-10-24T00:00:00Z")).toMatch(/2026/);
});
