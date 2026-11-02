import { expect, it } from "vitest";
import { ARCHIVE_DEFAULTS, readArchiveParams, writeArchiveParams, archiveSearch, safeArchiveSearch, pageToOffset, offsetToPage } from "../src/api/archiveParams.js";
it("reads empty and invalid archive values as defaults", () => {
  expect(readArchiveParams(new URLSearchParams())).toEqual(ARCHIVE_DEFAULTS);
  for (const page of ["0", "-2", "abc", "1.5", "99999", "2x"]) expect(readArchiveParams(new URLSearchParams({ page, category: "zzz", view: "bad" }))).toEqual(ARCHIVE_DEFAULTS);
});
it("trims and caps search, omits defaults and round trips state", () => {
  expect(readArchiveParams(new URLSearchParams({ q: `  ${"x".repeat(205)}  ` })).query).toBe("x".repeat(200));
  expect(writeArchiveParams(ARCHIVE_DEFAULTS).toString()).toBe("");
  const state = { query: "reef", category: "30000000-0000-4000-8000-000000000001", page: 2, view: "map" };
  expect(readArchiveParams(writeArchiveParams(state))).toEqual(state);
  expect(safeArchiveSearch(archiveSearch(state))).toBe(archiveSearch(state));
});
it("accepts only canonical archive searches", () => {
  for (const value of [undefined, "https://example.test/?page=2", "page=2", "?page=1", "?page=abc", "?q=reef&evil=x", "?q=x&q=y", "?category=zzz"]) expect(safeArchiveSearch(value)).toBe("");
  expect(safeArchiveSearch("?page=2")).toBe("?page=2");
});
it("converts pages and offsets", () => {
  for (const page of [1, 2, 10000]) expect(offsetToPage(pageToOffset(page, 6), 6)).toBe(page);
});
