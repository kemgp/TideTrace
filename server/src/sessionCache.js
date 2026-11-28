import { createHash } from "node:crypto";

// The result of the sign-in check (Supabase user and TideTrace profile), kept for a short time so signed-in
// reads do not ask Supabase twice before every route. Only `authenticate` in middleware.js uses it:
// - member reads (GET, HEAD on routes without a role requirement) may reuse a result; staff and admin routes
//   and all writes check again, and a write drops the caller's entry;
// - failures are never stored;
// - an entry lasts SESSION_SECONDS at most, and never past the token's own expiry.
// Row-level security still checks every database query with the caller's token. What can lag, by up to
// SESSION_SECONDS, is the API's own answer to a member read after an admin suspends an account.
// Keys are SHA-256 hashes of the token, so the cache never holds a usable token.
export const SESSION_SECONDS = 30;

export function createSessionCache({ seconds = SESSION_SECONDS, max = 2000, now = () => Date.now() } = {}) {
  const entries = new Map();
  const key = (token) => createHash("sha256").update(token).digest("base64url");
  return {
    get(token) {
      const id = key(token);
      const entry = entries.get(id);
      if (!entry) return null;
      if (entry.until <= now()) { entries.delete(id); return null; }
      return entry;
    },
    set(token, user, profile) {
      const until = Math.min(now() + seconds * 1000, tokenExpiry(token) ?? Infinity);
      if (until <= now()) return;
      const id = key(token);
      entries.delete(id);
      entries.set(id, { user, profile, until });
      while (entries.size > max) entries.delete(entries.keys().next().value); // the oldest goes first
    },
    drop(token) { entries.delete(key(token)); },
    get size() { return entries.size; },
  };
}

// The token's `exp` claim, read without checking the signature. That is safe here because it can only make an
// entry expire sooner, never later, and Supabase has already checked the token before anything is stored.
export function tokenExpiry(token) {
  try {
    const exp = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")).exp;
    return Number.isFinite(exp) ? exp * 1000 : null;
  } catch { return null; }
}
