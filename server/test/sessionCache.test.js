import test from "node:test";
import assert from "node:assert/strict";
import { createSessionCache, tokenExpiry } from "../src/sessionCache.js";

const jwt = (payload) => `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
const user = { id: "u1", email: "member@example.test" };
const profile = { id: "u1", role: "user", status: "active" };

test("a sign-in check is kept for 30 seconds, then asked for again", () => {
  let clock = 0;
  const sessions = createSessionCache({ now: () => clock });
  sessions.set("token-a", user, profile);
  assert.deepEqual(sessions.get("token-a").profile, profile);
  assert.equal(sessions.get("token-b"), null);
  clock = 29_999;
  assert.ok(sessions.get("token-a"));
  clock = 30_000;
  assert.equal(sessions.get("token-a"), null);
  assert.equal(sessions.size, 0);
});

test("an entry never outlives the token's own expiry", () => {
  let clock = 1_000_000;
  const sessions = createSessionCache({ now: () => clock });
  const soon = jwt({ exp: (clock + 10_000) / 1000 });
  sessions.set(soon, user, profile);
  clock += 9_999;
  assert.ok(sessions.get(soon));
  clock += 1;
  assert.equal(sessions.get(soon), null);
  sessions.set(jwt({ exp: (clock - 1000) / 1000 }), user, profile);
  assert.equal(sessions.size, 0);
  assert.equal(tokenExpiry("not-a-jwt"), null);
  assert.equal(tokenExpiry(jwt({ sub: "u1" })), null);
});

test("dropping, the size cap, and keys that never hold the token", () => {
  const sessions = createSessionCache({ max: 2 });
  sessions.set("token-a", user, profile);
  sessions.set("token-b", user, profile);
  sessions.set("token-c", user, profile);
  assert.equal(sessions.size, 2);
  assert.equal(sessions.get("token-a"), null);
  sessions.drop("token-b");
  assert.equal(sessions.get("token-b"), null);
  assert.ok(sessions.get("token-c"));
});
