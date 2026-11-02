import { expect, it } from "vitest";
import { contributionSearch, readContributionParams, safeContributionSearch, writeContributionParams } from "../src/api/contributionParams.js";

const read = (query) => readContributionParams(new URLSearchParams(query));

it("defaults to all statuses on page 1", () => {
  expect(read("")).toEqual({ status: "All", page: 1 });
});
it("rejects unknown statuses and bad page numbers", () => {
  expect(read("status=banana").status).toBe("All");
  for (const page of ["0", "-2", "abc", "1.5", "99999"]) expect(read(`page=${page}`).page).toBe(1);
});
it("accepts a known status and page", () => {
  expect(read("status=draft&page=3")).toEqual({ status: "draft", page: 3 });
});
it("omits defaults when writing and round-trips", () => {
  expect(writeContributionParams({ status: "All", page: 1 }).toString()).toBe("");
  const state = { status: "revision", page: 2 };
  expect(read(writeContributionParams(state).toString())).toEqual(state);
  expect(contributionSearch(state)).toBe("?status=revision&page=2");
  expect(contributionSearch({ status: "All", page: 1 })).toBe("");
});
it("only trusts a canonical search string for the Back link", () => {
  expect(safeContributionSearch("?status=draft&page=2")).toBe("?status=draft&page=2");
  for (const value of [undefined, "status=draft", "https://evil.test/?status=draft", "?status=banana", "?page=1"]) expect(safeContributionSearch(value)).toBe("");
});
