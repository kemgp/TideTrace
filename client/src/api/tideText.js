// Plain-text helpers for lesson cards. Lesson bodies are plain text, so there is no markup to strip.

// A short preview: whitespace collapsed, cut at a word boundary.
export function tideExcerpt(body, max = 120) {
  const text = typeof body === "string" ? body.replace(/\s+/g, " ").trim() : "";
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s.,;:!?]+$/, "")}…`;
}

// Whole minutes at about 200 words a minute, never less than one. Null when there is no body.
export function readingMinutes(body) {
  const words = typeof body === "string" ? body.split(/\s+/).filter(Boolean).length : 0;
  return words ? Math.max(1, Math.ceil(words / 200)) : null;
}

export const TIDE_TONES = 5;

// A stable colour slot for a lesson, so a lesson keeps its colour between visits.
export function tideTone(id) {
  let hash = 0;
  for (const char of String(id ?? "")) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % TIDE_TONES;
}
