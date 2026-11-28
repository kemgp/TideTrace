import test from "node:test";
import assert from "node:assert/strict";
import { createSignedLinks } from "../src/signedLinks.js";

// A stand-in for the Supabase client: counts signing calls and returns a new link each time.
function storage() {
  const state = { single: 0, batch: 0, fail: false };
  const db = { storage: { from: (bucket) => ({
    createSignedUrl: async (path, seconds) => { state.single += 1; state.seconds = seconds; return state.fail ? { data: null, error: { status: 503, message: "down" } } : { data: { signedUrl: `${bucket}/${path}?n=${state.single}` }, error: null }; },
    createSignedUrls: async (paths) => { state.batch += 1; return { data: paths.map((path) => path.startsWith("missing") ? { path, signedUrl: null, error: "Not found" } : { path, signedUrl: `${bucket}/${path}?b=${state.batch}`, error: null }), error: null }; },
  }) } };
  return { db, state };
}

test("a link is reused until less than 15 minutes remain, then signed again", async () => {
  let clock = 0;
  const links = createSignedLinks({ now: () => clock });
  const { db, state } = storage();
  const first = await links.one(db, "trace-media", "a.png");
  assert.equal(state.seconds, 3600);
  assert.equal(first.expiresIn, 3600);
  clock = 44 * 60 * 1000;
  const reused = await links.one(db, "trace-media", "a.png");
  assert.equal(reused.url, first.url);
  assert.equal(reused.expiresIn, 16 * 60);
  clock = 46 * 60 * 1000;
  const fresh = await links.one(db, "trace-media", "a.png");
  assert.notEqual(fresh.url, first.url);
  assert.equal(state.single, 2);
});

test("batches sign only what is not cached and leave out paths Storage refuses", async () => {
  const links = createSignedLinks();
  const { db, state } = storage();
  await links.one(db, "tide-assets", "cover.png");
  const urls = await links.many(db, "tide-assets", ["cover.png", "image.png", "missing.png", "image.png", null]);
  assert.equal(urls.get("cover.png"), "tide-assets/cover.png?n=1");
  assert.equal(urls.get("image.png"), "tide-assets/image.png?b=1");
  assert.equal(urls.has("missing.png"), false);
  assert.equal(state.batch, 1);
  await links.many(db, "tide-assets", ["cover.png", "image.png"]);
  assert.equal(state.batch, 1);
});

test("buckets are kept apart, the cache has a size cap and failures are not cached", async () => {
  const links = createSignedLinks({ max: 2 });
  const { db, state } = storage();
  await links.one(db, "trace-media", "same.png");
  await links.one(db, "profile-photos", "same.png");
  assert.equal(state.single, 2);
  await links.one(db, "trace-media", "third.png");
  assert.equal(links.size, 2);
  await links.one(db, "trace-media", "same.png");
  assert.equal(state.single, 4);
  state.fail = true;
  await assert.rejects(links.one(db, "trace-media", "broken.png"));
  state.fail = false;
  await links.one(db, "trace-media", "broken.png");
  assert.equal(state.single, 6);
});

test("expiresIn reports the seconds left on a cached link, and 0 for one never signed", async () => {
  let clock = 0;
  const links = createSignedLinks({ now: () => clock });
  const { db } = storage();
  await links.many(db, "trace-media", ["a.webp"]);
  clock = 10 * 60 * 1000;
  assert.equal(links.expiresIn("trace-media", "a.webp"), 50 * 60);
  assert.equal(links.expiresIn("trace-media", "other.webp"), 0);
  assert.equal(links.expiresIn("tide-assets", "a.webp"), 0);
});
