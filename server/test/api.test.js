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
