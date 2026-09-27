import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
import { matchesFileType } from "../src/routes/media.js";

const userId = "10000000-0000-4000-8000-000000000001";
const traceId = "20000000-0000-4000-8000-000000000001";
const categoryId = "30000000-0000-4000-8000-000000000001";
const mediaId = "40000000-0000-4000-8000-000000000001";
const draft = { title: "Coral survey", description: "Reef observations", category_id: categoryId, location_name: "Lawis" };
const config = readConfig({ SUPABASE_URL: "https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test" });
const json = (data, status = 200) => new Response(data === null ? null : JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

function fixture({ role = "user", status = "active", handler = () => undefined } = {}) {
  const calls = [];
  const state = { role, status };
  const app = createApp({ config, fetchImpl: async (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const headers = new Headers(init.headers);
    let body = init.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { /* Non-JSON payload. */ } }
    const call = { url, headers, method: init.method || "GET", body };
    calls.push(call);
    const custom = await handler(call);
    if (custom) return custom;
    if (url.pathname === "/auth/v1/user") {
      if (headers.get("authorization") === "Bearer expired") return json({ message: "Invalid JWT" }, 401);
      return json({ id: userId, email: "member@example.test" });
    }
    if (url.pathname === "/rest/v1/rpc/get_my_profile") return json([{ id: userId, display_name: "Member", role: state.role, status: state.status }]);
    return json({ message: "Unhandled test endpoint", code: "NOT_MOCKED" }, 500);
  } });
  return { app, calls, state };
}
const bearer = (req, token = "member-token") => req.set("Authorization", `Bearer ${token}`);
const businessCalls = (calls) => calls.filter((call) => !["/auth/v1/user", "/rest/v1/rpc/get_my_profile"].includes(call.url.pathname));

test("health works without credentials; data routes return actionable 503", async () => {
  const app = createApp({ config: readConfig({}) });
  const health = await request(app).get("/api/health").expect(200);
  assert.equal(health.body.data.configured, false);
  assert.equal((await request(app).get("/api/traces").expect(503)).body.error.code, "NOT_CONFIGURED");
});

test("config refuses privileged keys and insecure remote URLs", () => {
  assert.throws(() => readConfig({ SUPABASE_URL: config.url, SUPABASE_PUBLISHABLE_KEY: "sb_secret_secret" }), /publishable/);
  const privileged = `e30.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.signature`;
  assert.throws(() => readConfig({ SUPABASE_URL: config.url, SUPABASE_PUBLISHABLE_KEY: privileged }), /publishable/);
  assert.throws(() => readConfig({ SUPABASE_URL: "http://remote.example", SUPABASE_PUBLISHABLE_KEY: config.key }), /HTTPS/);
  assert.throws(() => readConfig({ PORT: "bad" }), /PORT/);
});

test("proxy configuration trusts only the immediate hop and defaults to direct connections", () => {
  for (const invalid of ["true", "-1", "1.5", "Infinity"]) {
    assert.throws(() => readConfig({ TRUST_PROXY_HOPS: invalid }), /TRUST_PROXY_HOPS/);
  }
  const direct = createApp({ config: readConfig({}) });
  assert.equal(direct.get("trust proxy"), false);
  const app = createApp({ config: readConfig({ TRUST_PROXY_HOPS: "1" }) });
  const trust = app.get("trust proxy fn");
  assert.equal(trust("127.0.0.1", 0), true);
  assert.equal(trust("203.0.113.1", 1), false);
});

test("signup forwards only supported account fields and never a role", async () => {
  const { app, calls } = fixture({ handler: ({ url }) => url.pathname === "/auth/v1/signup" ? json({ id: userId, email: "member@example.test" }) : undefined });
  const body = { display_name: "Member", email: "member@example.test", password: "long-password" };
  await request(app).post("/api/auth/register").send({ ...body, role: "admin" }).expect(400);
  assert.equal(calls.length, 0);
  const response = await request(app).post("/api/auth/register").send(body).expect(201);
  assert.equal(response.body.data.session, null);
  assert.deepEqual(calls[0].body.data, { display_name: "Member" });
});

test("login and refresh return real upstream session tokens", async () => {
  const { app, calls } = fixture({ handler: ({ url }) => url.pathname === "/auth/v1/token" ? json({ access_token: "access", refresh_token: "refresh", expires_in: 3600, user: { id: userId, email: "member@example.test", user_metadata: { private: true } } }) : undefined });
  const login = await request(app).post("/api/auth/login").send({ email: "member@example.test", password: "password" }).expect(200);
  assert.equal(login.body.data.session.access_token, "access");
  assert.equal(login.body.data.user.user_metadata, undefined);
  await request(app).post("/api/auth/refresh").send({ refresh_token: "refresh" }).expect(200);
  assert.deepEqual(calls.map(({ url }) => url.searchParams.get("grant_type")), ["password", "refresh_token"]);
});

test("unauthenticated, malformed and expired credentials cannot write", async () => {
  const { app, calls } = fixture();
  await request(app).post("/api/traces").send(draft).expect(401);
  await request(app).post("/api/traces").set("Authorization", "admin").send(draft).expect(401);
  await bearer(request(app).post("/api/traces"), "expired").send(draft).expect(401);
  assert.equal(businessCalls(calls).length, 0);
});

test("suspended users can inspect their profile but cannot write", async () => {
  const { app, calls } = fixture({ status: "suspended" });
  await bearer(request(app).get("/api/auth/me")).expect(200);
  const response = await bearer(request(app).post("/api/traces")).send(draft).expect(403);
  assert.equal(response.body.error.code, "ACCOUNT_SUSPENDED");
  assert.equal(businessCalls(calls).length, 0);
});

test("a verified Auth account without a profile gets an actionable error and cannot write", async () => {
  const { app, calls } = fixture({ handler: ({ url }) => url.pathname === "/rest/v1/rpc/get_my_profile" ? json([]) : undefined });
  const response = await bearer(request(app).get("/api/auth/me")).expect(403);
  assert.equal(response.body.error.code, "PROFILE_MISSING");
  assert.match(response.body.error.message, /login was verified/);
  await bearer(request(app).post("/api/traces")).send(draft).expect(403);
  assert.equal(calls.some(({ url }) => url.pathname === "/rest/v1/rpc/save_trace_draft"), false);
  assert.equal(calls.filter(({ url }) => url.pathname === "/rest/v1/rpc/get_my_profile").every(({ headers }) => headers.get("authorization") === "Bearer member-token"), true);
});

test("member and moderator tokens cannot perform admin operations", async () => {
  for (const role of ["user", "moderator"]) {
    const { app, calls } = fixture({ role });
    await bearer(request(app).patch(`/api/admin/users/${userId}`)).send({ role: "admin", status: "active", reason: "Escalate" }).expect(403);
    assert.equal(businessCalls(calls).length, 0);
  }
});

test("role changes take effect on the next request", async () => {
  const { app, calls, state } = fixture({ role: "admin", handler: ({ url }) => url.pathname === "/rest/v1/rpc/admin_list_profiles" ? json([]) : undefined });
  await bearer(request(app).get("/api/admin/users")).expect(200);
  state.role = "user";
  await bearer(request(app).get("/api/admin/users")).expect(403);
  assert.equal(businessCalls(calls).length, 1);
});

test("public feeds filter approved, visible content even for staff callers", async () => {
  const { app, calls } = fixture({ handler: ({ url }) => url.pathname === "/rest/v1/traces" ? json([]) : undefined });
  await bearer(request(app).get("/api/traces?limit=5&offset=10&category_id=" + categoryId)).expect(200);
  const query = calls[0].url.searchParams;
  assert.equal(query.get("status"), "eq.approved");
  assert.equal(query.get("is_hidden"), "eq.false");
  assert.equal(query.get("deleted_at"), "is.null");
  assert.equal(query.get("category_id"), `eq.${categoryId}`);
  assert.equal(query.get("limit"), "5");
  assert.equal(query.get("offset"), "10");
});

test("pagination and unknown filters are validated", async () => {
  const { app, calls } = fixture();
  await request(app).get("/api/traces?limit=1000").expect(400);
  await request(app).get("/api/traces?status=pending").expect(400);
  assert.equal(calls.length, 0);
});

test("contributions and notifications explicitly filter the authenticated owner", async () => {
  const { app, calls } = fixture({ handler: ({ url }) => ["/rest/v1/traces", "/rest/v1/notifications"].includes(url.pathname) ? json([]) : undefined });
  await bearer(request(app).get("/api/contributions")).expect(200);
  await bearer(request(app).get("/api/notifications")).expect(200);
  const dataCalls = businessCalls(calls);
  assert.equal(dataCalls[0].url.searchParams.get("author_id"), `eq.${userId}`);
  assert.equal(dataCalls[1].url.searchParams.get("recipient_id"), `eq.${userId}`);
});

test("category reads request only active categories in name order", async () => {
  const { app, calls } = fixture({ handler: ({ url }) => url.pathname === "/rest/v1/categories" ? json([{ id: categoryId, name: "Coral", is_active: true }]) : undefined });
  const response = await request(app).get("/api/categories").expect(200);
  assert.equal(response.body.data[0].name, "Coral");
  assert.equal(calls[0].url.searchParams.get("is_active"), "eq.true");
  assert.equal(calls[0].url.searchParams.get("order"), "name.asc");
});

test("public details apply visibility filters even with a staff token", async () => {
  const { app, calls } = fixture({ role: "admin", handler: ({ url }) => url.pathname === "/rest/v1/traces" ? json([]) : undefined });
  await bearer(request(app).get(`/api/traces/${traceId}`), "admin-token").expect(404);
  const query = calls[0].url.searchParams;
  assert.equal(query.get("id"), `eq.${traceId}`);
  assert.equal(query.get("status"), "eq.approved");
  assert.equal(query.get("is_hidden"), "eq.false");
  assert.equal(query.get("deleted_at"), "is.null");
});

test("private detail checks both record ID and authenticated owner and rejects owner overrides", async () => {
  const otherId = "10000000-0000-4000-8000-000000000002";
  const { app, calls } = fixture({ handler: ({ url }) => {
    if (url.pathname !== "/rest/v1/traces") return undefined;
    // The requested record belongs to another user, so the owner filter excludes it.
    return json(url.searchParams.get("author_id") === `eq.${otherId}` ? [{ id: traceId, author_id: otherId }] : []);
  } });
  await request(app).get(`/api/contributions/${traceId}`).expect(401);
  await bearer(request(app).get(`/api/contributions/${traceId}`)).expect(404);
  const query = businessCalls(calls)[0].url.searchParams;
  assert.equal(query.get("id"), `eq.${traceId}`);
  assert.equal(query.get("author_id"), `eq.${userId}`);
  await bearer(request(app).get(`/api/contributions?author_id=${otherId}`)).expect(400);
  assert.equal(businessCalls(calls).length, 1);
});

test("draft writes use guarded RPC and never accept supplied author/status", async () => {
  const { app, calls } = fixture({ handler: ({ url }) => url.pathname === "/rest/v1/rpc/save_trace_draft" ? json({ id: traceId, version: 1, status: "draft" }) : undefined });
  await bearer(request(app).post("/api/traces")).send({ ...draft, author_id: userId, status: "approved" }).expect(400);
  await bearer(request(app).post("/api/traces")).send({ ...draft, latitude: 10 }).expect(400);
  const response = await bearer(request(app).post("/api/traces")).send(draft).expect(201);
  assert.equal(response.body.data.status, "draft");
  const [call] = businessCalls(calls);
  assert.equal(call.body.p_id, null);
  assert.equal(call.body.p_version, null);
  assert.equal(call.body.p_latitude, null);
  assert.equal(call.headers.get("authorization"), "Bearer member-token");
});

test("edit, submit and moderation reject stale versions with 409", async () => {
  const { app } = fixture({ role: "moderator", handler: ({ url }) => /\/(save_trace_draft|submit_trace|moderate_trace)$/.test(url.pathname) ? json({ code: "40001", message: "Stale submission version" }, 400) : undefined });
  await bearer(request(app).put(`/api/traces/${traceId}`)).send({ ...draft, version: 1 }).expect(409);
  await bearer(request(app).post(`/api/traces/${traceId}/submit`)).send({ version: 1 }).expect(409);
  const response = await bearer(request(app).post(`/api/moderation/traces/${traceId}/decision`)).send({ version: 1, decision: "approved" }).expect(409);
  assert.equal(response.body.error.code, "STALE_VERSION");
});

test("moderation requires staff and feedback for rejection", async () => {
  const member = fixture();
  await bearer(request(member.app).post(`/api/moderation/traces/${traceId}/decision`)).send({ version: 1, decision: "approved" }).expect(403);
  const { app, calls } = fixture({ role: "moderator", handler: ({ url }) => url.pathname === "/rest/v1/rpc/moderate_trace" ? json({ id: traceId, status: "revision_requested" }) : undefined });
  await bearer(request(app).post(`/api/moderation/traces/${traceId}/decision`)).send({ version: 1, decision: "rejected" }).expect(400);
  await bearer(request(app).post(`/api/moderation/traces/${traceId}/decision`)).send({ version: 2, decision: "revision_requested", reason: "Please add location details" }).expect(200);
  assert.equal(businessCalls(calls)[0].body.p_version, 2);
});

test("database ownership and last-admin rejections propagate safely", async () => {
  const { app } = fixture({ role: "admin", handler: ({ url }) => {
    if (url.pathname.endsWith("/admin_set_account")) return json({ code: "P0001", message: "Cannot remove the last active admin" }, 400);
    if (url.pathname.endsWith("/submit_trace")) return json({ code: "42501", message: "Submission is not eligible" }, 403);
  } });
  await bearer(request(app).post(`/api/traces/${traceId}/submit`)).send({ version: 1 }).expect(403);
  const response = await bearer(request(app).patch(`/api/admin/users/${userId}`)).send({ role: "user", status: "active", reason: "Demote" }).expect(400);
  assert.match(response.body.error.message, /last active admin/);
});

test("reports require exactly one target; authors are database assigned", async () => {
  const { app, calls } = fixture({ handler: ({ url }) => url.pathname === "/rest/v1/reports" ? json([{ id: mediaId }], 201) : undefined });
  await bearer(request(app).post("/api/reports")).send({ trace_id: traceId, comment_id: mediaId, reason: "Spam" }).expect(400);
  await bearer(request(app).post("/api/reports")).send({ reason: "Spam" }).expect(400);
  await bearer(request(app).post("/api/reports")).send({ trace_id: traceId, reason: "Spam" }).expect(201);
  assert.deepEqual(businessCalls(calls)[0].body, { trace_id: traceId, reason: "Spam" });
});

test("notification unread count is authenticated, owner scoped, and counts only unread rows", async () => {
  const { app, calls } = fixture({ handler: ({ url, method }) => {
    if (url.pathname === "/rest/v1/notifications" && method === "HEAD") {
      return new Response(null, { status: 200, headers: { "content-range": "0-0/37" } });
    }
  } });
  await request(app).get("/api/notifications/unread-count").expect(401);
  const response = await bearer(request(app).get("/api/notifications/unread-count")).expect(200);
  assert.deepEqual(response.body.data, { count: 37 });
  const call = calls.find(({ url }) => url.pathname === "/rest/v1/notifications");
  assert.equal(call.url.searchParams.get("recipient_id"), `eq.${userId}`);
  assert.equal(call.url.searchParams.get("read_at"), "is.null");
  assert.equal(call.headers.get("prefer"), "count=exact");
});

test("notification updates call owner-scoped RPC, including explicit mark-all", async () => {
  const { app, calls } = fixture({ handler: ({ url }) => url.pathname.endsWith("/mark_notifications_read") ? json(null, 204) : undefined });
  await bearer(request(app).post("/api/notifications/read")).send({}).expect(400);
  await bearer(request(app).post("/api/notifications/read")).send({ ids: null }).expect(204);
  assert.deepEqual(businessCalls(calls)[0].body, { p_ids: null });
});

test("uploads enforce file signatures, draft ownership and generated paths", async () => {
  const { app, calls } = fixture({ handler: ({ url }) => {
    if (url.pathname === "/rest/v1/traces") return json([{ id: traceId, author_id: userId, status: "draft", is_hidden: false, deleted_at: null }]);
    if (url.pathname.startsWith("/storage/v1/object/trace-media/")) return json({ Key: "uploaded" });
    if (url.pathname.endsWith("/attach_trace_media")) return json({ id: mediaId });
  } });
  await bearer(request(app).post(`/api/traces/${traceId}/media`)).set("Content-Type", "text/html").send("<script>bad</script>").expect(415);
  await bearer(request(app).post(`/api/traces/${traceId}/media`)).set("Content-Type", "image/png").send(Buffer.from("not really an image")).expect(400);
  const image = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  await bearer(request(app).post(`/api/traces/${traceId}/media`)).set("Content-Type", "image/png").send(image).expect(201);
  const upload = calls.find(({ url }) => url.pathname.startsWith("/storage/v1/object/"));
  assert.match(upload.url.pathname, new RegExp(`/trace-media/${userId}/${traceId}/[0-9a-f-]+\\.png$`));
  assert.equal(upload.headers.get("x-upsert"), "false");
  assert.equal(upload.headers.get("authorization"), "Bearer member-token");
});

test("submitted evidence cannot be overwritten and attachment retry cannot use another owner", async () => {
  const { app, calls } = fixture({ handler: ({ url }) => url.pathname === "/rest/v1/traces" ? json([{ id: traceId, author_id: userId, status: "pending" }]) : undefined });
  const image = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  await bearer(request(app).post(`/api/traces/${traceId}/media`)).set("Content-Type", "image/png").send(image).expect(403);
  await bearer(request(app).post(`/api/traces/${traceId}/media/attach`)).send({ object_path: `${mediaId}/${traceId}/${mediaId}.png` }).expect(400);
  assert.equal(calls.some(({ url }) => url.pathname.startsWith("/storage/")), false);
});

test("media links are short lived and signed under caller permissions", async () => {
  const { app, calls } = fixture({ handler: ({ url }) => {
    if (url.pathname === "/rest/v1/trace_media") return json([{ object_path: `${userId}/${traceId}/file.png` }]);
    if (url.pathname.startsWith("/storage/v1/object/sign/")) return json({ signedURL: "/object/sign/trace-media/file.png?token=signed" });
  } });
  const response = await bearer(request(app).get(`/api/media/${mediaId}/url`)).expect(200);
  assert.equal(response.body.data.expires_in, 60);
  assert.equal(calls[1].body.expiresIn, 60);
});

test("auth tokens are isolated between requests", async () => {
  const { app, calls } = fixture({ handler: ({ url }) => url.pathname === "/rest/v1/categories" ? json([]) : undefined });
  await bearer(request(app).get("/api/categories"), "alice").expect(200);
  await bearer(request(app).get("/api/categories"), "bob").expect(200);
  await request(app).get("/api/categories").expect(200);
  assert.deepEqual(calls.map(({ headers }) => headers.get("authorization")), ["Bearer alice", "Bearer bob", `Bearer ${config.key}`]);
});

test("CORS, malformed JSON, large bodies and unknown routes return JSON errors", async () => {
  const { app } = fixture();
  await request(app).get("/api/health").set("Origin", "https://untrusted.example").expect(403);
  const options = await request(app).options("/api/traces").set("Origin", "http://localhost:5173").expect(204);
  assert.equal(options.headers["access-control-allow-origin"], "http://localhost:5173");
  await request(app).post("/api/auth/login").set("Content-Type", "application/json").send("{").expect(400);
  await request(app).post("/api/auth/login").send({ password: "a".repeat(300000) }).expect(413);
  const missing = await request(app).get("/api/missing").expect(404);
  assert.equal(missing.body.error.code, "NOT_FOUND");
  assert.equal(missing.headers["cache-control"], "no-store");
});

test("upstream failures do not leak internal error details", async () => {
  const { app } = fixture({ handler: () => json({ message: "private database details", details: "secret" }, 500) });
  const response = await request(app).get("/api/categories").expect(502);
  assert.doesNotMatch(JSON.stringify(response.body), /private database|secret/);
  assert.ok(response.body.error.request_id);
});

test("authentication endpoints are rate limited", async () => {
  const { app } = fixture();
  for (let i = 0; i < 30; i++) await request(app).post("/api/auth/login").send({}).expect(400);
  const response = await request(app).post("/api/auth/login").send({}).expect(429);
  assert.equal(response.body.error.code, "RATE_LIMITED");
});

test("routine session checks do not consume the login budget and remain rate limited", async () => {
  const { app } = fixture();
  for (let i = 0; i < 120; i++) await bearer(request(app).get("/api/auth/me")).expect(200);
  await bearer(request(app).get("/api/auth/me")).expect(429);
  await request(app).post("/api/auth/login").send({}).expect(400);
});

test("revoked refresh tokens return a session-expired error without exposing tokens", async () => {
  for (const error_code of ["refresh_token_not_found", "refresh_token_already_used", "session_not_found", "session_expired"]) {
    const { app } = fixture({ handler: () => json({ code: 400, error_code, msg: "private-refresh-token" }, 400) });
    const response = await request(app).post("/api/auth/refresh").send({ refresh_token: "private-refresh-token" }).expect(401);
    assert.equal(response.body.error.code, "SESSION_EXPIRED");
    assert.doesNotMatch(JSON.stringify(response.body), /private-refresh-token/);
  }
});

test("file type checks reject empty and mismatched data", () => {
  assert.equal(matchesFileType(Buffer.alloc(0), "image/png"), false);
  assert.equal(matchesFileType(Buffer.from("abcdefghijklmnop"), "image/jpeg"), false);
});

test("auth errors preserve actionable codes even when GoTrue supplies a numeric code", async () => {
  for (const [source, expected, status] of [
    ["invalid_credentials", "INVALID_CREDENTIALS", 401],
    ["email_not_confirmed", "EMAIL_NOT_CONFIRMED", 403],
    ["otp_expired", "INVALID_VERIFICATION_CODE", 400],
  ]) {
    const { app } = fixture({ handler: () => json({ code: 400, error_code: source, msg: "Internal provider details" }, 400) });
    const response = await request(app).post("/api/auth/login").send({ email: "member@example.test", password: "password" }).expect(status);
    assert.equal(response.body.error.code, expected);
    assert.doesNotMatch(JSON.stringify(response.body), /Internal provider details/);
  }
});

test("signup and resend use a configured frontend callback, never an arbitrary redirect", async () => {
  const { app, calls } = fixture({ handler: ({ url }) => ["/auth/v1/signup", "/auth/v1/resend"].includes(url.pathname) ? json({ id: userId }) : undefined });
  await request(app).post("/api/auth/register").set("Origin", "http://127.0.0.1:5173")
    .send({ email: "member@example.test", password: "long-password", display_name: "Member" }).expect(201);
  assert.equal(calls[0].url.searchParams.get("redirect_to"), "http://127.0.0.1:5173/auth/callback");
  await request(app).post("/api/auth/resend").send({ email: "member@example.test" }).expect(200);
  assert.equal(calls[1].url.searchParams.get("redirect_to"), "http://localhost:5173/auth/callback");
  await request(app).post("/api/auth/resend").send({ email: "member@example.test", redirect_to: "https://attacker.example" }).expect(400);
  await request(app).post("/api/auth/resend").set("Origin", "https://attacker.example").send({ email: "member@example.test" }).expect(403);
  assert.equal(calls.length, 2);
});

test("password recovery sends a trusted callback and a generic account-existence response", async () => {
  const { app, calls } = fixture({ handler: ({ url }) => url.pathname === "/auth/v1/recover" ? json({}) : undefined });
  const response = await request(app).post("/api/auth/forgot-password").set("Origin", "http://127.0.0.1:5173")
    .send({ email: "member@example.test" }).expect(200);
  assert.equal(calls[0].url.searchParams.get("redirect_to"), "http://127.0.0.1:5173/auth/callback");
  assert.deepEqual(calls[0].body, { email: "member@example.test" });
  assert.match(response.body.data.message, /If the account exists/);
  await request(app).post("/api/auth/forgot-password").send({ email: "member@example.test", redirect_to: "https://attacker.example" }).expect(400);
  await request(app).post("/api/auth/forgot-password").set("Origin", "https://attacker.example").send({ email: "member@example.test" }).expect(403);
  assert.equal(calls.length, 1);
});

test("recovery distinguishes Supabase email quotas from request limits", async () => {
  for (const [source, expected, message] of [
    ["over_email_send_rate_limit", "EMAIL_RATE_LIMITED", /email sending limit/],
    ["over_request_rate_limit", "AUTH_RATE_LIMITED", /Wait a few minutes/],
  ]) {
    const { app } = fixture({ handler: () => json({ code: 429, error_code: source, msg: "Internal provider details" }, 429) });
    const response = await request(app).post("/api/auth/forgot-password").send({ email: "member@example.test" }).expect(429);
    assert.equal(response.body.error.code, expected);
    assert.match(response.body.error.message, message);
    assert.doesNotMatch(JSON.stringify(response.body), /Internal provider details/);
  }
});

test("password changes require a verified session and never mutate the account profile or role", async () => {
  const { app, calls } = fixture({ role: "admin", handler: ({ url, method }) => url.pathname === "/auth/v1/user" && method === "PUT" ? json({ id: userId }) : undefined });
  const body = { password: "a-new-strong-password-42" };
  await request(app).put("/api/auth/password").send(body).expect(401);
  await bearer(request(app).put("/api/auth/password"), "expired").send(body).expect(401);
  await bearer(request(app).put("/api/auth/password")).send({ ...body, role: "admin" }).expect(400);
  await bearer(request(app).put("/api/auth/password")).send(body).expect(204);
  const writes = calls.filter(({ method }) => method === "PUT");
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].body, body);
  assert.equal(writes[0].headers.get("authorization"), "Bearer member-token");
  assert.equal(calls.some(({ url }) => /admin_set_account|profiles$/.test(url.pathname)), false);
});

test("password policy and reauthentication errors remain actionable", async () => {
  for (const [source, expected, status] of [["weak_password", "WEAK_PASSWORD", 400], ["same_password", "SAME_PASSWORD", 400], ["reauthentication_needed", "RECOVERY_EXPIRED", 401]]) {
    const { app } = fixture({ handler: ({ url, method }) => url.pathname === "/auth/v1/user" && method === "PUT" ? json({ code: 422, error_code: source }, 422) : undefined });
    const response = await bearer(request(app).put("/api/auth/password")).send({ password: "a-new-strong-password-42" }).expect(status);
    assert.equal(response.body.error.code, expected);
  }
});

test("draft creation permits unfinished text but requires a valid category", async () => {
  const { app, calls } = fixture({ handler: ({ url }) => url.pathname.endsWith("/save_trace_draft") ? json({ id: traceId, version: 1, status: "draft" }) : undefined });
  const unfinished = { title: "", description: "", location_name: "", category_id: categoryId };
  await bearer(request(app).post("/api/traces")).send({ ...unfinished, category_id: "" }).expect(400);
  await bearer(request(app).post("/api/traces")).send(unfinished).expect(201);
  assert.equal(businessCalls(calls).length, 1);
  assert.deepEqual(businessCalls(calls)[0].body, { p_id: null, p_version: null, p_title: "", p_description: "", p_location_name: "", p_category_id: categoryId, p_latitude: null, p_longitude: null });
});

test("draft updates require the loaded version and preserve supplied coordinates", async () => {
  const { app, calls } = fixture({ handler: ({ url }) => url.pathname.endsWith("/save_trace_draft") ? json({ id: traceId, version: 5, status: "draft" }) : undefined });
  await bearer(request(app).put(`/api/traces/${traceId}`)).send(draft).expect(400);
  await bearer(request(app).put(`/api/traces/${traceId}`)).send({ ...draft, version: 4, latitude: 10, longitude: 124 }).expect(200);
  assert.equal(businessCalls(calls).length, 1);
  assert.deepEqual(businessCalls(calls)[0].body, { p_id: traceId, p_version: 4, p_title: draft.title, p_description: draft.description, p_location_name: draft.location_name, p_category_id: categoryId, p_latitude: 10, p_longitude: 124 });
});

test("partial uploads return the owned object path for attachment recovery", async () => {
  const { app, calls } = fixture({ handler: ({ url }) => {
    if (url.pathname === "/rest/v1/traces") return json([{ id: traceId, author_id: userId, status: "draft", is_hidden: false, deleted_at: null }]);
    if (url.pathname.startsWith("/storage/v1/object/trace-media/")) return json({ Key: "uploaded" });
    if (url.pathname.endsWith("/attach_trace_media")) return json({ message: "Temporary failure" }, 500);
  } });
  const image = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  const response = await bearer(request(app).post(`/api/traces/${traceId}/media`)).set("Content-Type", "image/png").send(image).expect(502);
  assert.equal(response.body.error.code, "MEDIA_ATTACH_FAILED");
  const attachedPath = calls.find(({ url }) => url.pathname.endsWith("/attach_trace_media")).body.p_object_path;
  assert.equal(response.body.error.details.object_path, attachedPath);
  assert.match(attachedPath, new RegExp(`^${userId}/${traceId}/[0-9a-f-]+\\.png$`));
});

test("attachment retry uses the existing object and removal calls the guarded detach RPC", async () => {
  const objectPath = `${userId}/${traceId}/${mediaId}.png`;
  const { app, calls } = fixture({ handler: ({ url }) => {
    if (url.pathname.endsWith("/attach_trace_media")) return json({ id: mediaId, trace_id: traceId, object_path: objectPath, mime_type: "image/png" });
    if (url.pathname.endsWith("/detach_trace_media")) return json(null, 204);
  } });
  await bearer(request(app).post(`/api/traces/${traceId}/media/attach`)).send({ object_path: objectPath }).expect(201);
  await bearer(request(app).delete(`/api/media/${mediaId}`)).expect(204);
  assert.deepEqual(businessCalls(calls).map(({ body }) => body), [{ p_trace_id: traceId, p_object_path: objectPath, p_sort_order: 0 }, { p_media_id: mediaId }]);
  assert.equal(calls.some(({ url }) => url.pathname.startsWith("/storage/")), false);
});

test("removal rejects unauthenticated callers and preserves database permission errors", async () => {
  const { app, calls } = fixture({ handler: ({ url }) => url.pathname.endsWith("/detach_trace_media") ? json({ code: "42501", message: "Submission is not editable" }, 403) : undefined });
  await request(app).delete(`/api/media/${mediaId}`).expect(401);
  assert.equal(businessCalls(calls).length, 0);
  await bearer(request(app).delete(`/api/media/${mediaId}`)).expect(403);
});

test("submission accepts only a version and uses the authenticated guarded workflow", async () => {
  const { app, calls } = fixture({ handler: ({ url }) => url.pathname.endsWith("/submit_trace") ? json({ id: traceId, version: 8, status: "pending" }) : undefined });
  await request(app).post(`/api/traces/${traceId}/submit`).send({ version: 7 }).expect(401);
  await bearer(request(app).post(`/api/traces/${traceId}/submit`)).send({}).expect(400);
  await bearer(request(app).post(`/api/traces/${traceId}/submit`)).send({ version: 0 }).expect(400);
  await bearer(request(app).post(`/api/traces/${traceId}/submit`)).send({ version: 7, status: "approved" }).expect(400);
  const response = await bearer(request(app).post(`/api/traces/${traceId}/submit`)).send({ version: 7 }).expect(200);
  assert.equal(response.body.data.status, "pending");
  assert.equal(businessCalls(calls).length, 1);
  assert.deepEqual(businessCalls(calls)[0].body, { p_id: traceId, p_version: 7 });
  assert.equal(businessCalls(calls)[0].headers.get("authorization"), "Bearer member-token");
});

test("submission preserves database eligibility and missing-evidence errors", async () => {
  for (const [code, status, message] of [["42501", 403, "Submission is not eligible"], ["P0001", 400, "Active category and at least one image required"]]) {
    const { app } = fixture({ handler: ({ url }) => url.pathname.endsWith("/submit_trace") ? json({ code, message }, 400) : undefined });
    const response = await bearer(request(app).post(`/api/traces/${traceId}/submit`)).send({ version: 1 }).expect(status);
    assert.equal(response.body.error.code, code === "42501" ? "FORBIDDEN" : "WORKFLOW_ERROR");
  }
});

test("staff Trace detail requires staff access and filters hidden/deleted records", async () => {
  const member = fixture();
  await request(member.app).get(`/api/moderation/traces/${traceId}`).expect(401);
  await bearer(request(member.app).get(`/api/moderation/traces/${traceId}`)).expect(403);
  assert.equal(businessCalls(member.calls).length, 0);
  for (const role of ["moderator", "admin"]) {
    const { app, calls } = fixture({ role, handler: ({ url }) => url.pathname === "/rest/v1/traces" ? json([{ id: traceId, status: "pending", version: 3 }]) : undefined });
    await bearer(request(app).get(`/api/moderation/traces/${traceId}`)).expect(200);
    const query = businessCalls(calls)[0].url.searchParams;
    assert.equal(query.get("id"), `eq.${traceId}`);
    assert.equal(query.get("is_hidden"), "eq.false");
    assert.equal(query.get("deleted_at"), "is.null");
    assert.equal(query.get("limit"), "1");
    assert.match(query.get("select"), /trace_media/);
  }
});

test("moderation history includes saved Trace titles and reviewer names", async () => {
  const { app, calls } = fixture({ role: "moderator", handler: ({ url }) => url.pathname === "/rest/v1/moderation_actions" ? json([]) : undefined });
  await bearer(request(app).get("/api/moderation/history?limit=25&offset=25")).expect(200);
  const query = businessCalls(calls)[0].url.searchParams;
  assert.match(query.get("select"), /trace:traces\(id,title\)/);
  assert.match(query.get("select"), /actor:profiles!moderation_actions_actor_id_fkey/);
  assert.equal(query.get("offset"), "25");
  assert.equal(query.get("order"), "created_at.desc,id.asc");
});

test("moderator decisions pass the reviewed version and allowed status to the guarded RPC", async () => {
  for (const decision of ["approved", "revision_requested", "rejected"]) {
    const { app, calls } = fixture({ role: "moderator", handler: ({ url }) => url.pathname.endsWith("/moderate_trace") ? json({ id: traceId, status: decision, version: 4 }) : undefined });
    const response = await bearer(request(app).post(`/api/moderation/traces/${traceId}/decision`)).send({ version: 3, decision, reason: "Evidence reviewed" }).expect(200);
    assert.equal(response.body.data.status, decision);
    assert.deepEqual(businessCalls(calls)[0].body, { p_id: traceId, p_version: 3, p_decision: decision, p_reason: "Evidence reviewed" });
  }
});

test("member review feedback verifies ownership before querying per-Trace history", async () => {
  const { app, calls } = fixture({ handler: ({ url }) => {
    if (url.pathname === "/rest/v1/traces") return json([{ id: traceId }]);
    if (url.pathname === "/rest/v1/moderation_actions") return json([{ id: mediaId, to_state: "revision_requested", reason: "Clarify location" }]);
  } });
  await request(app).get(`/api/contributions/${traceId}/reviews`).expect(401);
  await bearer(request(app).get(`/api/contributions/${traceId}/reviews?limit=5&offset=5`)).expect(200);
  const queries = businessCalls(calls).map(({ url }) => url.searchParams);
  assert.equal(queries[0].get("id"), `eq.${traceId}`);
  assert.equal(queries[0].get("author_id"), `eq.${userId}`);
  assert.equal(queries[1].get("trace_id"), `eq.${traceId}`);
  assert.equal(queries[1].get("action"), "eq.review_trace");
  assert.equal(queries[1].get("select"), "id,from_state,to_state,reason,created_at");
  assert.equal(queries[1].get("offset"), "5");
  assert.equal(queries[1].get("order"), "created_at.desc,id.desc");
});

test("another member cannot read feedback for an inaccessible contribution", async () => {
  const { app, calls } = fixture({ handler: ({ url }) => url.pathname === "/rest/v1/traces" ? json([]) : undefined });
  await bearer(request(app).get(`/api/contributions/${traceId}/reviews`)).expect(404);
  assert.equal(calls.some(({ url }) => url.pathname === "/rest/v1/moderation_actions"), false);
});

test("staff can read prior review decisions while members cannot use staff feedback routes", async () => {
  const member = fixture();
  await bearer(request(member.app).get(`/api/moderation/traces/${traceId}/reviews`)).expect(403);
  const { app, calls } = fixture({ role: "moderator", handler: ({ url }) => {
    if (url.pathname === "/rest/v1/traces") return json([{ id: traceId }]);
    if (url.pathname === "/rest/v1/moderation_actions") return json([]);
  } });
  await bearer(request(app).get(`/api/moderation/traces/${traceId}/reviews`)).expect(200);
  const queries = businessCalls(calls).map(({ url }) => url.searchParams);
  assert.equal(queries[0].get("is_hidden"), "eq.false");
  assert.equal(queries[0].get("deleted_at"), "is.null");
  assert.equal(queries[1].get("trace_id"), `eq.${traceId}`);
});

const tideId = "50000000-0000-4000-8000-000000000001";
const lesson = { title: "How to Submit a Useful Trace", slug: "how-to-submit-a-useful-trace", body: "Describe what you observed.", status: "draft" };

test("Tides admin create, publish, unpublish and archive use saved records and publication filters", async () => {
  let saved;
  let revision = 0;
  const { app, calls } = fixture({ role: "admin", handler: ({ url, method, body }) => {
    if (url.pathname !== "/rest/v1/tides") return;
    if (method === "POST") { saved = { ...body, id: tideId, updated_at: `2026-09-25T00:00:0${++revision}.000Z` }; return json([saved], 201); }
    if (method === "PATCH") {
      if (url.searchParams.get("updated_at") !== `eq.${saved.updated_at}`) return json([]);
      saved = { ...saved, ...body, updated_at: `2026-09-25T00:00:0${++revision}.000Z` }; return json([saved]);
    }
    return json(saved && (!url.searchParams.has("status") || url.searchParams.get("status") === `eq.${saved.status}`) ? [saved] : []);
  } });
  await bearer(request(app).post("/api/admin/tides")).send(lesson).expect(201);
  await bearer(request(app).get(`/api/admin/tides/${tideId}`)).expect(200);
  await request(app).get(`/api/tides/${tideId}`).expect(404);
  assert.deepEqual((await request(app).get("/api/tides").expect(200)).body.data, []);
  for (const status of ["published", "draft", "published", "archived"]) {
    const expected = saved.updated_at;
    const response = await bearer(request(app).put(`/api/admin/tides/${tideId}`)).send({ ...lesson, status, updated_at: expected }).expect(200);
    assert.equal(response.body.data.status, status);
    await request(app).get(`/api/tides/${tideId}`).expect(status === "published" ? 200 : 404);
    const list = await request(app).get("/api/tides?limit=25&offset=0").expect(200);
    assert.equal(list.body.data.length, status === "published" ? 1 : 0);
  }
  for (const call of calls.filter((call) => call.method === "PATCH")) {
    assert.equal(call.headers.get("authorization"), "Bearer member-token");
    assert.equal(call.url.searchParams.get("id"), `eq.${tideId}`);
    assert.equal(Object.hasOwn(call.body, "updated_at"), false);
  }
});

test("Tides admin reads and writes deny anonymous, member and moderator access", async () => {
  for (const role of ["user", "moderator"]) {
    const { app, calls } = fixture({ role });
    await request(app).get(`/api/admin/tides/${tideId}`).expect(401);
    await request(app).post("/api/admin/tides").send(lesson).expect(401);
    await bearer(request(app).get("/api/admin/tides")).expect(403);
    await bearer(request(app).get(`/api/admin/tides/${tideId}`)).expect(403);
    await bearer(request(app).post("/api/admin/tides")).send(lesson).expect(403);
    await bearer(request(app).put(`/api/admin/tides/${tideId}`)).send({ ...lesson, updated_at: "2026-09-25T00:00:00Z" }).expect(403);
    assert.equal(businessCalls(calls).length, 0);
  }
});

test("Tides validate publication, slugs, timestamps and extra fields before writing", async () => {
  const { app, calls } = fixture({ role: "admin" });
  for (const fields of [{ body: " ", status: "published" }, { slug: "Bad Slug" }, { title: " " }, { status: "unknown" }, { author_id: userId }]) {
    await bearer(request(app).post("/api/admin/tides")).send({ ...lesson, ...fields }).expect(400);
  }
  await bearer(request(app).put(`/api/admin/tides/${tideId}`)).send(lesson).expect(400);
  await bearer(request(app).put(`/api/admin/tides/${tideId}`)).send({ ...lesson, updated_at: "bad" }).expect(400);
  assert.equal(businessCalls(calls).length, 0);
});

test("Tides rejects stale updates instead of overwriting another editor", async () => {
  const { app, calls } = fixture({ role: "admin", handler: ({ url }) => url.pathname === "/rest/v1/tides" ? json([]) : undefined });
  const response = await bearer(request(app).put(`/api/admin/tides/${tideId}`)).send({ ...lesson, updated_at: "2026-09-25T00:00:00Z" }).expect(409);
  assert.equal(response.body.error.code, "STALE_VERSION");
  assert.equal(businessCalls(calls)[0].url.searchParams.get("updated_at"), "eq.2026-09-25T00:00:00Z");
});

test("Tides duplicate slugs return a conflict without exposing database details", async () => {
  const { app } = fixture({ role: "admin", handler: ({ url }) => url.pathname === "/rest/v1/tides" ? json({ code: "23505", message: "duplicate key" }, 409) : undefined });
  const response = await bearer(request(app).post("/api/admin/tides")).send(lesson).expect(409);
  assert.equal(response.body.error.code, "ALREADY_EXISTS");
});

test("Tides public detail always filters published status, including for admins", async () => {
  const { app, calls } = fixture({ role: "admin", handler: ({ url }) => url.pathname === "/rest/v1/tides" ? json([]) : undefined });
  await bearer(request(app).get(`/api/tides/${tideId}`)).expect(404);
  const query = calls.find((call) => call.url.pathname === "/rest/v1/tides").url.searchParams;
  assert.equal(query.get("status"), "eq.published");
  assert.equal(query.get("id"), `eq.${tideId}`);
  await request(app).get("/api/tides?status=draft").expect(400);
});
test("Tide completion creates a completion for the authenticated user", async () => {
  const completion = {
    user_id: userId,
    tide_id: tideId,
    completed_at: "2026-09-25T10:00:00.000Z",
  };

  let inserted = false;

  const { app, calls } = fixture({
    handler: ({ url, method }) => {
      if (url.pathname === "/rest/v1/tides") {
        return json([{ id: tideId }]);
      }

      if (url.pathname === "/rest/v1/tide_completions") {
        if (method === "GET") {
          return json([]);
        }

        if (method === "POST") {
          inserted = true;
          return json([completion]);
        }
      }
    },
  });

  const response = await bearer(
    request(app).put(`/api/tides/${tideId}/completion`)
  ).expect(201);

  assert.deepEqual(response.body.data, completion);
  assert.equal(inserted, true);

  const insert = calls.find(
    ({ url, method }) =>
      url.pathname === "/rest/v1/tide_completions" &&
      method === "POST"
  );

  assert.ok(insert);
  assert.deepEqual(insert.body, {
    user_id: userId,
    tide_id: tideId,
  });
});


test("Tide completion is idempotent and does not create a duplicate", async () => {
  const completion = {
    user_id: userId,
    tide_id: tideId,
    completed_at: "2026-09-25T10:00:00.000Z",
  };

  let inserted = false;

  const { app, calls } = fixture({
    handler: ({ url, method }) => {
      if (url.pathname === "/rest/v1/tides") {
        return json([{ id: tideId }]);
      }

      if (url.pathname === "/rest/v1/tide_completions") {
        if (method === "GET") {
          return json(inserted ? [completion] : []);
        }

        if (method === "POST") {
          inserted = true;
          return json([completion]);
        }
      }
    },
  });

  const first = await bearer(
    request(app).put(`/api/tides/${tideId}/completion`)
  ).expect(201);

  const second = await bearer(
    request(app).put(`/api/tides/${tideId}/completion`)
  ).expect(200);

  assert.deepEqual(first.body.data, completion);
  assert.deepEqual(second.body.data, completion);

  const inserts = calls.filter(
    ({ url, method }) =>
      url.pathname === "/rest/v1/tide_completions" &&
      method === "POST"
  );

  assert.equal(inserts.length, 1);
});
