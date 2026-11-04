// "3 days ago" for people, the full date for hover and assistive tech.
const UNITS = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];

export function relativeTime(value, now = Date.now()) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "";
  const seconds = (time - now) / 1000;
  const size = Math.abs(seconds);
  for (const [unit, length] of UNITS) {
    if (size >= length) return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(Math.round(seconds / length), unit);
  }
  return "just now";
}

// "24 Oct 2026" for cards.
export function shortDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function fullDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { dateStyle: "long" });
}
