// Prepares a plain-text or Markdown file for the lesson editor. Lessons use "##" for chapter headings.
// A Markdown file that uses "# Title" lines for its main headings has every heading moved one level down,
// so its top headings become chapters ("###" is the deepest level lessons show).
export const MAX_IMPORT_CHARS = 100000;
export const MAX_IMPORT_BYTES = 300 * 1024;

export function prepareImport(text) {
  let result = String(text ?? "").replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  if (/^# \S/m.test(result)) result = result.replace(/^(#{1,3}) (?=\S)/gm, (_, marks) => `${"#".repeat(Math.min(marks.length + 1, 3))} `);
  return result.trim();
}
