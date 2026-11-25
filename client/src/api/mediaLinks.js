// Turns a Trace media id into an address an <img> or <video> can show.
//
// Public photos (approved, visible Traces) come back as a signed link that the server keeps the same for up
// to an hour. We remember it for this browser session, so the Traces list, the Trace page, the map and the
// landing strip reuse one download instead of fetching the photo again on every view.
//
// `size`: "thumb" (480 px, for cards and lists); leave it out for the Trace page (the 1600 px display copy).
// The server falls back to the original when a copy does not exist yet.
//
// Restricted photos (draft, pending, held, hidden) never get a shareable link. The API sends the file itself
// and we show it from a blob: address that only works in this tab. Callers must call `revoke` when done.
//
// Lists and Trace pages usually arrive with the link already on each public photo (`thumb_url` or
// `display_url`, see server/src/traceMedia.js). Pass it as `supplied` (from `suppliedLink`) and no request
// is made. A retry should not pass it, so a link that stopped working is replaced by a fresh one.
const links = new Map(); // `${owner}:${id}` -> { url, until }
const MARGIN_MS = 60 * 1000;
const MAX_LINKS = 500;

const keyFor = (owner, id, size) => `${owner || "anon"}:${id}:${size || "display"}`;
const isLink = (url) => typeof url === "string" && /^https?:\/\//.test(url);

function remember(key, url, expiresIn) {
  const until = Date.now() + (Number(expiresIn) || 0) * 1000 - MARGIN_MS;
  if (until <= Date.now()) return false;
  links.delete(key);
  links.set(key, { url, until });
  while (links.size > MAX_LINKS) links.delete(links.keys().next().value);
  return true;
}

// The link a list or Trace page sent with this photo for `size` ("thumb", or leave out for the display copy),
// or null when there is none (restricted photo, older response, Storage could not sign it).
export function suppliedLink(media, size) {
  const url = size === "thumb" ? media?.thumb_url : media?.display_url;
  return isLink(url) ? { url, expires_in: media.link_expires_in } : null;
}

export async function loadMedia({ id, owner, read, signal, size, supplied }) {
  const key = keyFor(owner, id, size);
  const query = size ? `?size=${size}` : "";
  const saved = links.get(key);
  if (saved && saved.until > Date.now()) return { url: saved.url, revoke: null };
  links.delete(key);
  if (isLink(supplied?.url) && remember(key, supplied.url, supplied.expires_in)) return { url: supplied.url, revoke: null };
  const data = await read(`media/${encodeURIComponent(id)}/url${query}`, { signal });
  if (isLink(data?.url)) {
    remember(key, data.url, data.expires_in);
    return { url: data.url, revoke: null };
  }
  if (data?.private) {
    const file = await read(`media/${encodeURIComponent(id)}/file${query}`, { signal, as: "blob" });
    if (!file || typeof file.size !== "number" || !file.size) throw new Error("No photo preview was returned.");
    const url = URL.createObjectURL(file);
    return { url, revoke: () => URL.revokeObjectURL(url) };
  }
  throw new Error("No photo preview was returned.");
}

// Drop a remembered link, for example after the image failed to load, so the next try asks the server again.
export function forgetMedia(owner, id, size) {
  links.delete(keyFor(owner, id, size));
}

export function forgetAllMedia() {
  links.clear();
}
