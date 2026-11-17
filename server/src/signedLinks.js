import { result } from "./errors.js";

// Signed Storage links that stay the same for a while, so browsers can reuse a download.
// Supabase signs a different link on every call, so a fresh link per request means a fresh download
// per view. Keeping one link per file until it is close to expiry lets the browser cache do its job.
//
// Only call this after the caller's own query (under row-level security) returned the path: the cache
// reuses the link, never the access check. Use it for files anyone who can read the row may see (public
// Trace photos, published lessons, author photos), not for restricted ones.
export const LINK_SECONDS = 3600;
const MIN_REMAINING_MS = 15 * 60 * 1000;

export function createSignedLinks({ seconds = LINK_SECONDS, minRemainingMs = MIN_REMAINING_MS, max = 5000, now = () => Date.now() } = {}) {
  const entries = new Map();
  const key = (bucket, path) => `${bucket}\u0000${path}`;

  function cached(bucket, path) {
    const id = key(bucket, path);
    const entry = entries.get(id);
    if (!entry) return null;
    entries.delete(id);
    if (entry.expiresAt - now() < minRemainingMs) return null;
    entries.set(id, entry); // Most recently used goes last; the oldest is dropped first.
    return entry;
  }
  function remember(bucket, path, url, signedAt) {
    const entry = { url, expiresAt: signedAt + seconds * 1000 };
    entries.set(key(bucket, path), entry);
    while (entries.size > max) entries.delete(entries.keys().next().value);
    return entry;
  }
  const remaining = (entry) => Math.max(0, Math.floor((entry.expiresAt - now()) / 1000));

  return {
    seconds,
    // One file. A failed Storage call throws, like any other upstream error.
    async one(db, bucket, path) {
      let entry = cached(bucket, path);
      if (!entry) {
        const signedAt = now();
        const data = await result(db.storage.from(bucket).createSignedUrl(path, seconds));
        entry = remember(bucket, path, data.signedUrl, signedAt);
      }
      return { url: entry.url, expiresIn: remaining(entry) };
    },
    // Several files in one Storage call. Paths Storage cannot sign are left out of the result;
    // a failed call throws so the caller can fall back (initials, colour blocks).
    async many(db, bucket, paths) {
      const urls = new Map();
      const missing = [];
      for (const path of new Set(paths.filter(Boolean))) {
        const entry = cached(bucket, path);
        if (entry) urls.set(path, entry.url);
        else missing.push(path);
      }
      if (missing.length) {
        const signedAt = now();
        const data = await result(db.storage.from(bucket).createSignedUrls(missing, seconds));
        for (const item of data || []) {
          if (item.error || !item.signedUrl) continue;
          remember(bucket, item.path, item.signedUrl, signedAt);
          urls.set(item.path, item.signedUrl);
        }
      }
      return urls;
    },
    get size() { return entries.size; },
  };
}
