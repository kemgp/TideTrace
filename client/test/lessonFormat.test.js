import { expect, it } from "vitest";
import { imageIds, inlineParts, parseLesson, splitChapters } from "../src/api/lessonFormat.js";
import { MAX_IMPORT_CHARS, prepareImport } from "../src/api/importText.js";

it("keeps plain text as paragraphs and preserves single line breaks", () => {
  expect(parseLesson("First line\nSecond line\n\nNext paragraph")).toEqual([
    { type: "p", lines: ["First line", "Second line"] },
    { type: "p", lines: ["Next paragraph"] },
  ]);
  expect(parseLesson("")).toEqual([]);
  expect(parseLesson(undefined)).toEqual([]);
  expect(parseLesson("a\r\n\r\nb")).toEqual([{ type: "p", lines: ["a"] }, { type: "p", lines: ["b"] }]);
});

it("finds headings, bullets and numbered runs", () => {
  expect(parseLesson("## Part one\n### Detail\n- apples\n* pears\n\n1. first\n2. second")).toEqual([
    { type: "h3", text: "Part one" },
    { type: "h4", text: "Detail" },
    { type: "ul", items: ["apples", "pears"] },
    { type: "ol", items: ["first", "second"] },
  ]);
});

it("treats a lone numbered line as text, so older numbered headings still read as before", () => {
  expect(parseLesson("1. Describe what you saw\nUse a specific title.")).toEqual([{ type: "p", lines: ["1. Describe what you saw", "Use a specific title."] }]);
});

it("ends a list at the next heading or paragraph, and a paragraph at a list", () => {
  expect(parseLesson("Intro\n- one\n- two\nAfter")).toEqual([
    { type: "p", lines: ["Intro"] },
    { type: "ul", items: ["one", "two"] },
    { type: "p", lines: ["After"] },
  ]);
  expect(parseLesson("- one\n## Heading")).toEqual([{ type: "ul", items: ["one"] }, { type: "h3", text: "Heading" }]);
});

it("does not treat hashes, dashes or asterisks without a following space as marks", () => {
  expect(parseLesson("#hashtag\n-5 degrees\n*note*")).toEqual([{ type: "p", lines: ["#hashtag", "-5 degrees", "*note*"] }]);
});

it("splits bold runs and leaves lone asterisks alone", () => {
  expect(inlineParts("a **b** c")).toEqual([{ text: "a " }, { text: "b", bold: true }, { text: " c" }]);
  expect(inlineParts("**x**")).toEqual([{ text: "x", bold: true }]);
  expect(inlineParts("5 * 3 ** 2")).toEqual([{ text: "5 * 3 ** 2" }]);
  expect(inlineParts("plain")).toEqual([{ text: "plain" }]);
});

it("passes markup through as text data", () => {
  expect(parseLesson('<img src=x onerror="alert(1)">')).toEqual([{ type: "p", lines: ['<img src=x onerror="alert(1)">'] }]);
});

const IMG = "0a1b2c3d-0000-4000-8000-00000000abcd";

it("reads an image line on its own as an image block, and keeps other text containing it as text", () => {
  expect(parseLesson(`Before\n![A shore at low tide](image:${IMG})\nAfter`)).toEqual([
    { type: "p", lines: ["Before"] },
    { type: "image", id: IMG, alt: "A shore at low tide" },
    { type: "p", lines: ["After"] },
  ]);
  expect(parseLesson(`![](image:${IMG.toUpperCase()})`)).toEqual([{ type: "image", id: IMG, alt: "" }]);
  // Not an image: a web address, an unknown scheme, text around it, or a malformed id stay plain text.
  for (const text of ["![x](https://example.test/a.png)", "![x](data:image/png;base64,AAAA)", `see ![x](image:${IMG}) here`, "![x](image:not-an-id)"]) {
    expect(parseLesson(text)).toEqual([{ type: "p", lines: [text] }]);
  }
});

it("lists the distinct image ids a lesson uses", () => {
  const blocks = parseLesson(`![a](image:${IMG})\n\n![b](image:${IMG})\n\n- item`);
  expect(imageIds(blocks)).toEqual([IMG]);
  expect(imageIds(parseLesson("No images here"))).toEqual([]);
});

it("splits a lesson into chapters at each ## heading, with an introduction for text before the first", () => {
  const chapters = splitChapters(parseLesson("Welcome text\n\n## One\nBody one\n\n### Part\nSub\n\n## Two\n- a\n- b"));
  expect(chapters.map((chapter) => chapter.title)).toEqual(["Introduction", "One", "Two"]);
  expect(chapters[1].blocks.map((block) => block.type)).toEqual(["h3", "p", "h4", "p"]);
  expect(chapters[2].blocks.map((block) => block.type)).toEqual(["h3", "ul"]);
  expect(splitChapters(parseLesson("## Only\ntext")).map((chapter) => chapter.title)).toEqual(["Only"]);
  expect(splitChapters(parseLesson("No headings"))).toHaveLength(1);
  expect(splitChapters([])).toEqual([]);
});

it("prepares imported text: normalises line endings and moves headings down when the file uses # titles", () => {
  expect(prepareImport("﻿Hello\r\nWorld\r\n")).toBe("Hello\nWorld");
  expect(prepareImport("## One\nText\n## Two")).toBe("## One\nText\n## Two");
  expect(prepareImport("# Chapter\ntext\n## Section\n### Deep\n#hashtag")).toBe("## Chapter\ntext\n### Section\n### Deep\n#hashtag");
  expect(prepareImport("   ")).toBe("");
  expect(MAX_IMPORT_CHARS).toBe(100000);
});
