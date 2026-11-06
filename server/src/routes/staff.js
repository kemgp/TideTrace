import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware.js";
import { first, result, HttpError } from "../errors.js";
import { category, decision, page, paginate, text, tide, uuid } from "../validation.js";
import { reviewSelect, traceSelect } from "./content.js";
import { withPrivateLocation } from "../traceLocations.js";

const reportSelect = "*,reporter:profiles!reports_reporter_id_fkey(id,display_name),resolver:profiles!reports_resolved_by_fkey(id,display_name),trace:traces(id,title,description,is_hidden,deleted_at,author:profiles!traces_author_id_fkey(id,display_name),trace_media(*)),comment:comments(id,body,trace_id,status,author:profiles!comments_author_id_fkey(id,display_name),trace:traces(id,title))";

export function staffRoutes(gateway) {
  const router = Router();
  router.use(authenticate(gateway, { roles: ["moderator", "admin"] }));
  router.get("/analytics", async (req, res) => {
    z.object({}).strict().parse(req.query);
    res.json({ data: await result(req.db.rpc("get_staff_analytics")) });
  });
  router.get("/traces", async (req, res) => {
    const input = page.extend({ status: z.enum(["pending", "approved", "rejected", "revision_requested", "draft"]).default("pending"), hold: z.enum(["exclude", "only", "all"]).optional(), flag: z.enum(["only"]).optional() }).parse(req.query);
    // Moderators never see held Traces in their queue; admins see everything unless they filter.
    const mode = req.profile.role === "admin" ? input.hold ?? "all" : "exclude";
    let query = req.db.from("traces").select(traceSelect).eq("status", input.status).eq("is_hidden", false).is("deleted_at", null);
    if (mode !== "all") {
      const held = (await result(req.db.from("trace_holds").select("trace_id"))).map((row) => row.trace_id);
      if (mode === "only") query = held.length ? query.in("id", held) : query.eq("id", "00000000-0000-0000-0000-000000000000");
      else if (held.length) query = query.not("id", "in", `(${held.join(",")})`);
    }
    if (input.status !== "pending") {
      res.json({ data: await result(paginate(query.order("submitted_at").order("id"), input)) });
      return;
    }
    // The pending queue puts Traces with open reports first, then the longest waiting.
    const [rows, reports] = await Promise.all([
      result(query.order("submitted_at").order("id").range(0, 499)),
      result(req.db.from("reports").select("trace_id").eq("status", "open").not("trace_id", "is", null)),
    ]);
    const counts = new Map();
    for (const row of reports) counts.set(row.trace_id, (counts.get(row.trace_id) || 0) + 1);
    let queue = rows.map((row) => ({ ...row, report_count: counts.get(row.id) || 0 }));
    if (input.flag === "only") queue = queue.filter((row) => row.report_count > 0);
    queue = [...queue.filter((row) => row.report_count > 0), ...queue.filter((row) => row.report_count === 0)];
    res.json({ data: queue.slice(input.offset, input.offset + input.limit) });
  });
  router.get("/traces/:id", async (req, res) => {
    const id = uuid.parse(req.params.id);
    const row = first(await result(req.db.from("traces").select(traceSelect).eq("id", id).eq("is_hidden", false).limit(1)));
    const holds = await result(req.db.from("trace_holds").select("reason,held_at,holder:profiles!trace_holds_held_by_fkey(id,display_name)").eq("trace_id", id).limit(1));
    res.json({ data: { ...(await withPrivateLocation(req.db, row)), hold: holds[0] ?? null } });
  });
  router.post("/traces/:id/hold", async (req, res) => {
    const input = z.object({ version: z.number().int().min(1), reason: text(2000) }).strict().parse(req.body);
    const saved = await result(req.db.rpc("hold_trace", { p_id: uuid.parse(req.params.id), p_version: input.version, p_reason: input.reason }));
    res.json({ data: await withPrivateLocation(req.db, saved) });
  });
  router.post("/traces/:id/release-hold", async (req, res) => {
    if (req.profile.role !== "admin") throw new HttpError(403, "FORBIDDEN", "Only an admin can release a hold.");
    const saved = await result(req.db.rpc("release_trace_hold", { p_id: uuid.parse(req.params.id) }));
    res.json({ data: await withPrivateLocation(req.db, saved) });
  });
  router.get("/authors/:id/summary", async (req, res) => {
    res.json({ data: await result(req.db.rpc("staff_author_summary", { p_author_id: uuid.parse(req.params.id) })) });
  });
  router.get("/traces/:id/reviews", async (req, res) => {
    const id = uuid.parse(req.params.id);
    const pagination = page.parse(req.query);
    first(await result(req.db.from("traces").select("id").eq("id", id).eq("is_hidden", false).limit(1)));
    res.json({ data: await result(paginate(req.db.from("moderation_actions").select(`${reviewSelect},actor_id,actor:profiles!moderation_actions_actor_id_fkey(id,display_name)`).eq("trace_id", id).eq("action", "review_trace").order("created_at", { ascending: false }).order("id", { ascending: false }), pagination)) });
  });
  router.post("/traces/:id/decision", async (req, res) => {
    const input = decision.parse(req.body);
    const saved = await result(req.db.rpc("moderate_trace", { p_id: uuid.parse(req.params.id), p_version: input.version, p_decision: input.decision, p_reason: input.reason }));
    res.json({ data: await withPrivateLocation(req.db, saved) });
  });
  router.get("/reports", async (req, res) => {
    const input = page.extend({ status: z.enum(["open", "resolved", "dismissed"]).default("open"), type: z.enum(["comment", "trace"]).optional() }).parse(req.query);
    let query = req.db.from("reports").select(reportSelect).eq("status", input.status);
    if (input.type) query = query.not(input.type === "comment" ? "comment_id" : "trace_id", "is", null);
    res.json({ data: await result(paginate(query.order("created_at").order("id"), input)) });
  });
  router.get("/reports/:id", async (req, res) => {
    res.json({ data: first(await result(req.db.from("reports").select(reportSelect).eq("id", uuid.parse(req.params.id)).limit(1))) });
  });
  router.post("/reports/resolve", async (req, res) => {
    const input = z.object({ ids: z.array(uuid).min(1).max(50), remove_content: z.boolean(), reason: text(2000) }).strict().parse(req.body);
    const resolved = await result(req.db.rpc("resolve_reports", { p_ids: [...new Set(input.ids)], p_remove_content: input.remove_content, p_reason: input.reason }));
    res.json({ data: { resolved } });
  });
  router.get("/reason-templates", async (req, res) => {
    const input = z.object({ kind: z.enum(["review", "report"]).optional() }).strict().parse(req.query);
    let query = req.db.from("moderator_reason_templates").select("id,kind,body,created_at").eq("owner_id", req.user.id);
    if (input.kind) query = query.eq("kind", input.kind);
    res.json({ data: await result(query.order("created_at").order("id")) });
  });
  router.post("/reason-templates", async (req, res) => {
    const input = z.object({ kind: z.enum(["review", "report"]), body: text(500) }).strict().parse(req.body);
    const existing = await result(req.db.from("moderator_reason_templates").select("id").eq("owner_id", req.user.id));
    if (existing.length >= 30) throw new HttpError(409, "LIMIT_REACHED", "You can keep up to 30 saved reasons. Delete one to add another.");
    res.status(201).json({ data: first(await result(req.db.from("moderator_reason_templates").insert({ kind: input.kind, body: input.body }).select("id,kind,body,created_at"))) });
  });
  router.delete("/reason-templates/:id", async (req, res) => {
    await result(req.db.from("moderator_reason_templates").delete().eq("id", uuid.parse(req.params.id)).eq("owner_id", req.user.id));
    res.sendStatus(204);
  });
  router.post("/reports/:id/resolve", async (req, res) => {
    const input = z.object({ remove_content: z.boolean(), reason: text(2000) }).strict().parse(req.body);
    await result(req.db.rpc("resolve_report", { p_id: uuid.parse(req.params.id), p_remove_content: input.remove_content, p_reason: input.reason }));
    res.sendStatus(204);
  });
  router.get("/history", async (req, res) => {
    const input = page.extend({ outcome: z.enum(["approved", "revision", "rejected", "kept", "removed", "dismissed"]).optional(), mine: z.enum(["true", "false"]).optional() }).parse(req.query);
    let query = req.db.from("moderation_actions").select("*,trace:traces(id,title,deleted_at,author:profiles!traces_author_id_fkey(id,display_name)),comment:comments(id,body,author:profiles!comments_author_id_fkey(id,display_name)),report:reports(id,status,reporter:profiles!reports_reporter_id_fkey(id,display_name),trace:traces(id,title,deleted_at,author:profiles!traces_author_id_fkey(id,display_name)),comment:comments(id,body,author:profiles!comments_author_id_fkey(id,display_name))),actor:profiles!moderation_actions_actor_id_fkey(id,display_name)");
    if (input.mine === "true") query = query.eq("actor_id", req.user.id);
    if (input.outcome) {
      const states = { approved: ["approved"], revision: ["revision_requested"], rejected: ["rejected"], kept: ["visible", "kept"], removed: ["hidden", "removed", "resolved"], dismissed: ["dismissed"] };
      query = query.in("to_state", states[input.outcome]);
      if (["approved", "revision", "rejected"].includes(input.outcome)) query = query.eq("action", "review_trace");
    }
    res.json({ data: await result(paginate(query.order("created_at", { ascending: false }).order("id"), input)) });
  });
  return router;
}

export function adminRoutes(gateway) {
  const router = Router();
  router.use(authenticate(gateway, { roles: ["admin"] }));
  router.get("/users", async (req, res) => {
    const input = page.extend({ role: z.enum(["user", "moderator", "admin"]).optional(), status: z.enum(["active", "suspended"]).optional(), q: z.string().trim().max(100).optional() }).parse(req.query);
    let query = req.db.rpc("admin_list_profiles");
    if (input.role) query = query.eq("role", input.role);
    if (input.status) query = query.eq("status", input.status);
    if (input.q) query = uuid.safeParse(input.q).success ? query.eq("id", input.q) : query.ilike("display_name", `%${input.q.replace(/[\\%_]/g, "\\$&")}%`);
    res.json({ data: await result(paginate(query.order("created_at", { ascending: false }).order("id"), input)) });
  });
  router.get("/users/:id", async (req, res) => {
    res.json({ data: first(await result(req.db.rpc("admin_list_profiles").eq("id", uuid.parse(req.params.id)).limit(1))) });
  });
  router.patch("/users/:id", async (req, res) => {
    const input = z.object({ role: z.enum(["user", "moderator", "admin"]), status: z.enum(["active", "suspended"]), reason: text(2000), updated_at: z.iso.datetime({ offset: true }) }).strict().parse(req.body);
    if (input.role === "admin") {
      const current = first(await result(req.db.rpc("admin_list_profiles").eq("id", uuid.parse(req.params.id)).limit(1)));
      if (current.role !== "admin") throw new HttpError(403, "ADMIN_ASSIGNMENT_DISABLED", "Admin roles cannot be assigned through account management.");
    }
    await result(req.db.rpc("admin_update_account", { p_expected_updated_at: input.updated_at, p_user_id: uuid.parse(req.params.id), p_role: input.role, p_status: input.status, p_reason: input.reason }));
    res.sendStatus(204);
  });
  router.get("/audit-logs", async (req, res) => {
    const input = page.extend({ target_user_id: uuid.optional() }).parse(req.query);
    let query = req.db.from("admin_audit_logs").select("*,actor:profiles!admin_audit_logs_actor_id_fkey(id,display_name)");
    if (input.target_user_id) query = query.eq("target_user_id", input.target_user_id);
    res.json({ data: await result(paginate(query.order("created_at", { ascending: false }).order("id"), input)) });
  });
  router.get("/tides/:id", async (req, res) => {
    res.json({ data: first(await result(req.db.from("tides").select("*").eq("id", uuid.parse(req.params.id)).limit(1))) });
  });
  for (const [resource, schema] of [["categories", category], ["tides", tide]]) {
    router.get(`/${resource}`, async (req, res) => {
      res.json({ data: await result(paginate(req.db.from(resource).select("*").order("created_at", { ascending: false }).order("id"), page.parse(req.query))) });
    });
    router.post(`/${resource}`, async (req, res) => {
      res.status(201).json({ data: first(await result(req.db.from(resource).insert(schema.parse(req.body)).select())) });
    });
    router.put(`/${resource}/:id`, async (req, res) => {
      if (resource === "tides" || resource === "categories") {
        const { updated_at, ...fields } = req.body || {};
        const expected = z.iso.datetime({ offset: true }).parse(updated_at);
        const rows = await result(req.db.from(resource).update(schema.parse(fields)).eq("id", uuid.parse(req.params.id)).eq("updated_at", expected).select());
        if (!rows?.length) throw new HttpError(409, "STALE_VERSION", "This record changed or is no longer available. Reload it before retrying.");
        return res.json({ data: first(rows) });
      }
      res.json({ data: first(await result(req.db.from(resource).update(schema.parse(req.body)).eq("id", uuid.parse(req.params.id)).select())) });
    });
  }
  router.get("/workflow-settings", async (req, res) => {
    res.json({ data: await result(req.db.rpc("get_workflow_settings")) });
  });
  router.put("/workflow-settings", async (req, res) => {
    const input = z.object({ value: z.object({ submissions_paused: z.boolean(), max_media_per_trace: z.number().int().min(1).max(10) }).strict(), updated_at: z.iso.datetime({ offset: true }).nullable() }).strict().parse(req.body);
    res.json({ data: await result(req.db.rpc("save_workflow_settings", { p_value: input.value, p_expected_updated_at: input.updated_at })) });
  });
  router.get("/settings", async (req, res) => {
    res.json({ data: await result(paginate(req.db.from("settings").select("*").order("key"), page.parse(req.query))) });
  });
  // Separate insert/update avoids PostgREST upsert requiring UPDATE on the key column.
  router.post("/settings", async (req, res) => {
    const input = z.object({ key: text(100), value: z.json() }).strict().parse(req.body);
    res.status(201).json({ data: first(await result(req.db.from("settings").insert(input).select())) });
  });
  router.put("/settings/:key", async (req, res) => {
    const input = z.object({ value: z.json() }).strict().parse(req.body);
    res.json({ data: first(await result(req.db.from("settings").update(input).eq("key", text(100).parse(req.params.key)).select())) });
  });
  return router;
}
