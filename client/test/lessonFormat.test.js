import { expect, it } from "vitest";
import { inlineParts, parseLesson } from "../src/api/lessonFormat.js";

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
