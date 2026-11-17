// Turns a Trace media id into an address an <img> or <video> can show.
//
// Public photos (approved, visible Traces) come back as a signed link that the server keeps the same for up
// to an hour. We remember it for this browser session, so the Traces list, the Trace page, the map and the
// landing strip reuse one download instead of fetching the photo again on every view.
//
// Restricted photos (draft, pending, held, hidden) never get a shareable link. The API sends the file itself
// and we show it from a blob: address that only works in this tab. Callers must call `revoke` when done.
const links = new Map(); // `${owner}:${id}` -> { url, until }
const MARGIN_MS = 60 * 1000;
const MAX_LINKS = 500;

const keyFor = (owner, id) => `${owner || "anon"}:${id}`;

export async function loadMedia({ id, owner, read, signal }) {
  const key = keyFor(owner, id);
  const saved = links.get(key);
  if (saved && saved.until > Date.now()) return { url: saved.url, revoke: null };
  links.delete(key);
  const data = await read(`media/${encodeURIComponent(id)}/url`, { signal });
  if (data?.url && /^https?:\/\//.test(data.url)) {
    const seconds = Number(data.expires_in) || 0;
    links.set(key, { url: data.url, until: Date.now() + seconds * 1000 - MARGIN_MS });
    while (links.size > MAX_LINKS) links.delete(links.keys().next().value);
    return { url: data.url, revoke: null };
  }
  if (data?.private) {
    const file = await read(`media/${encodeURIComponent(id)}/file`, { signal, as: "blob" });
    if (!file || typeof file.size !== "number" || !file.size) throw new Error("No photo preview was returned.");
    const url = URL.createObjectURL(file);
    return { url, revoke: () => URL.revokeObjectURL(url) };
  }
  throw new Error("No photo preview was returned.");
}

// Drop a remembered link, for example after the image failed to load, so the next try asks the server again.
export function forgetMedia(owner, id) {
  links.delete(keyFor(owner, id));
}

export function forgetAllMedia() {
  links.clear();
}
