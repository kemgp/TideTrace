// A small, safe formatter for lesson text. Lessons are written as plain text; these marks add structure:
//   "## Heading" and "### Subheading", "- item" or "* item" bullets, consecutive "1. item" lines,
//   "**bold**", an image line "![description](image:ID)" on its own, and a blank line between paragraphs. Anything else stays as written, with line breaks kept.
// It returns plain data, never markup, so lesson text can never inject HTML.

const HEADING = /^(#{2,3})\s+(.+)$/;
const BULLET = /^[-*]\s+(.+)$/;
const NUMBERED = /^\d{1,3}[.)]\s+(.+)$/;
const IMAGE = /^!\[([^\]]{0,200})\]\(image:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)$/i;

// Splits one line of text into plain and bold runs.
export function inlineParts(text) {
  const parts = [];
  const pattern = /\*\*(\S(?:.*?\S)?)\*\*/g;
  let last = 0;
  let match;
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index) });
    parts.push({ text: match[1], bold: true });
    last = pattern.lastIndex;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

// Returns blocks: { type: "h3" | "h4", text }, { type: "p", lines: [...] }, { type: "ul" | "ol", items: [...] },
// and { type: "image", id, alt }.
// The lesson title is the page's h2, so "##" becomes h3 and "###" becomes h4.
export function parseLesson(source) {
  const lines = String(source ?? "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let paragraph = [];
  let list = null;
  const flushParagraph = () => { if (paragraph.length) blocks.push({ type: "p", lines: paragraph }); paragraph = []; };
  const flushList = () => { if (list) blocks.push(list); list = null; };
  const startList = (type) => { if (list?.type !== type) { flushList(); list = { type, items: [] }; } };
  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line) { flushParagraph(); flushList(); return; }
    const image = IMAGE.exec(line);
    if (image) { flushParagraph(); flushList(); blocks.push({ type: "image", id: image[2].toLowerCase(), alt: image[1].trim() }); return; }
    const heading = HEADING.exec(line);
    if (heading) { flushParagraph(); flushList(); blocks.push({ type: heading[1].length === 2 ? "h3" : "h4", text: heading[2].trim() }); return; }
    const bullet = BULLET.exec(line);
    if (bullet) { flushParagraph(); startList("ul"); list.items.push(bullet[1]); return; }
    const numbered = NUMBERED.exec(line);
    // A lone "1. Title" line followed by text is a heading-like line, not a list; only runs of numbered lines are lists.
    if (numbered && (list?.type === "ol" || NUMBERED.test((lines[index + 1] || "").trim()))) { flushParagraph(); startList("ol"); list.items.push(numbered[1]); return; }
    flushList();
    paragraph.push(line);
  });
  flushParagraph();
  flushList();
  return blocks;
}

// Splits parsed blocks into chapters at each "##" heading (h3 block). Text before the first heading is an
// "Introduction" chapter. Returns [{ title, blocks }]; the heading stays as the first block of its chapter.
export function splitChapters(blocks) {
  const chapters = [];
  for (const block of blocks) {
    if (block.type === "h3") chapters.push({ title: block.text, blocks: [block] });
    else if (chapters.length) chapters[chapters.length - 1].blocks.push(block);
    else chapters.push({ title: "Introduction", blocks: [block] });
  }
  return chapters;
}

// Image ids a lesson refers to, so the page only asks for images when the text uses some.
export function imageIds(blocks) {
  return [...new Set(blocks.filter((block) => block.type === "image").map((block) => block.id))];
}
