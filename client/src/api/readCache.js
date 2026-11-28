import { ApiError } from "./auth.js";

// One shared copy of recent API reads in this browser tab, per signed-in account (speed plan S3).
//
// - Identical reads at the same time share one request: when the dashboard totals are shown by four
//   components, or the notification list by the menu and the dashboard, the browser asks once.
// - The last successful answer per account and path is kept, so a page can paint at once from it while
//   it asks again (`peekRead`). Callers always ask again; the copy is never the final answer.
// - `maxAge` lets a caller reuse an answer that is younger than that many milliseconds instead of asking.
// - Any save (`invalidateReads`, called by writeData) and signing out (`clearReads`) drop the copies, and a
//   request that was already running when that happened is not kept.
//
// Files (`as: "blob"`) never come through here. Keys include the account id, so one account never sees
// another account's answers.
const PEEK_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 200;
const entries = new Map(); // key -> { data, at }
const inflight = new Map(); // key -> promise
let generation = 0;

const keyFor = (owner, path) => `${owner}\u0000${path}`;
const cancelled = () => new ApiError("Request cancelled.", "CANCELLED");

function remember(key, data) {
  entries.delete(key);
  entries.set(key, { data, at: Date.now() });
  while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value);
}

// Lets one caller stop waiting without cancelling the request that other callers share.
function untilAborted(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(cancelled());
  return new Promise((resolve, reject) => {
    const stop = () => reject(cancelled());
    signal.addEventListener("abort", stop, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", stop));
  });
}

// `load` runs the real request (with no signal of its own) only when no identical request is running.
export function sharedRead(owner, path, load, { signal, maxAge } = {}) {
  const key = keyFor(owner, path);
  if (maxAge > 0) {
    const saved = entries.get(key);
    if (saved && Date.now() - saved.at < maxAge) return untilAborted(Promise.resolve(saved.data), signal);
  }
  let promise = inflight.get(key);
  if (!promise) {
    const started = generation;
    promise = Promise.resolve().then(load).then((data) => {
      if (generation === started) remember(key, data);
      return data;
    }).finally(() => { if (inflight.get(key) === promise) inflight.delete(key); });
    inflight.set(key, promise);
  }
  return untilAborted(promise, signal);
}

// The last answer for this account and path from the last five minutes, or undefined.
export function peekRead(owner, path) {
  if (!owner || !path) return undefined;
  const saved = entries.get(keyFor(owner, path));
  return saved && Date.now() - saved.at < PEEK_MS ? saved.data : undefined;
}

// After a save: drop this account's copies, and let the next read start a new request.
export function invalidateReads(owner) {
  generation += 1;
  const prefix = `${owner}\u0000`;
  for (const key of [...entries.keys()]) if (key.startsWith(prefix)) entries.delete(key);
  for (const key of [...inflight.keys()]) if (key.startsWith(prefix)) inflight.delete(key);
}

export function clearReads() {
  generation += 1;
  entries.clear();
  inflight.clear();
}
