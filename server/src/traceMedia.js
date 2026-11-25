// Which Trace photo file to send, and who may get a shareable link to it. Shared by /media/:id/url and by
// the lists and Trace pages that send links with their rows (withPhotoLinks), so both follow the same rules.

// size "thumb" (cards, lists) is the 480 px copy; anything else (the Trace page) is the 1600 px display copy.
// Each falls back to the next larger file that exists, ending at the original. Copies are made at upload or
// by scripts/backfill-media-variants.mjs; the original itself is never changed.
export function pickMediaFile(media, size) {
  const path = size === "thumb" ? media.thumb_path || media.display_path || media.object_path
    : media.display_path || media.object_path;
  return { path, type: path === media.object_path ? media.mime_type : "image/webp" };
}

// Only photos of approved, visible Traces get a signed link. Anything else (draft, pending, revision, held,
// hidden) is fetched through /media/:id/file, so nothing shareable leaves the API.
export const isPublicTrace = (trace) => trace?.status === "approved" && trace?.is_hidden === false && !trace?.deleted_at;

// The same photo a card picks on the client (PHOTO_TYPES in client/src/api/photos.js), lowest sort_order first.
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const firstPhoto = (media) => media.filter((item) => item?.id && PHOTO_TYPES.includes(item.mime_type))
  .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0];

// Adds signed links to the trace_media rows of public Traces, signed in one Storage call and reused from the
// app's link cache, so the browser does not ask /media/:id/url once per photo.
// size "thumb": only the first photo of each Trace (what a card shows), as `thumb_url`.
// size "display": every file of the Trace (the Trace page), as `display_url`.
// Each linked row also gets `link_expires_in` (seconds). Rows that are restricted, or that Storage could not
// sign, get no link and the client falls back to /media/:id/url. Call this only with rows the caller's own
// query (under row-level security) returned: the cache reuses links, never the access check.
export async function withPhotoLinks(db, links, rows, { size }) {
  const field = size === "thumb" ? "thumb_url" : "display_url";
  const wanted = new Map(); // media id -> storage path
  for (const row of rows) {
    if (!isPublicTrace(row) || !Array.isArray(row.trace_media)) continue;
    const items = size === "thumb" ? [firstPhoto(row.trace_media)].filter(Boolean) : row.trace_media.filter((item) => item?.id);
    for (const item of items) wanted.set(item.id, pickMediaFile(item, size).path);
  }
  if (!wanted.size) return rows;
  let urls;
  try { urls = await links.many(db, "trace-media", [...wanted.values()]); }
  catch { return rows; /* each photo falls back to its own /media/:id/url request */ }
  return rows.map((row) => {
    if (!Array.isArray(row.trace_media) || !row.trace_media.some((item) => wanted.has(item?.id))) return row;
    return { ...row, trace_media: row.trace_media.map((item) => {
      const path = wanted.get(item?.id);
      const url = path && urls.get(path);
      if (!url) return item;
      return { ...item, [field]: url, link_expires_in: links.expiresIn("trace-media", path) };
    }) };
  });
}
