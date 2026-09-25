import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware.js";
import { first, result, HttpError } from "../errors.js";
import { category, decision, page, paginate, text, tide, uuid } from "../validation.js";
import { reviewSelect, traceSelect } from "./content.js";

export function staffRoutes(gateway) {
  const router = Router();
  router.use(authenticate(gateway, { roles: ["moderator", "admin"] }));
  router.get("/traces", async (req, res) => {
    const input = page.extend({ status: z.enum(["pending", "approved", "rejected", "revision_requested", "draft"]).default("pending") }).parse(req.query);
    res.json({ data: await result(paginate(req.db.from("traces").select(traceSelect).eq("status", input.status).eq("is_hidden", false).is("deleted_at", null).order("submitted_at").order("id"), input)) });
  });
  router.get("/traces/:id", async (req, res) => {
    res.json({ data: first(await result(req.db.from("traces").select(traceSelect).eq("id", uuid.parse(req.params.id)).eq("is_hidden", false).is("deleted_at", null).limit(1))) });
  });
  router.get("/traces/:id/reviews", async (req, res) => {
    const id = uuid.parse(req.params.id);
    const pagination = page.parse(req.query);
    first(await result(req.db.from("traces").select("id").eq("id", id).eq("is_hidden", false).is("deleted_at", null).limit(1)));
    res.json({ data: await result(paginate(req.db.from("moderation_actions").select(reviewSelect).eq("trace_id", id).eq("action", "review_trace").order("created_at", { ascending: false }).order("id", { ascending: false }), pagination)) });
  });
  router.post("/traces/:id/decision", async (req, res) => {
    const input = decision.parse(req.body);
    res.json({ data: await result(req.db.rpc("moderate_trace", { p_id: uuid.parse(req.params.id), p_version: input.version, p_decision: input.decision, p_reason: input.reason })) });
  });
  router.get("/reports", async (req, res) => {
    const input = page.extend({ status: z.enum(["open", "resolved", "dismissed"]).default("open") }).parse(req.query);
    res.json({ data: await result(paginate(req.db.from("reports").select("*,trace:traces(id,title),comment:comments(id,body,trace_id)").eq("status", input.status).order("created_at").order("id"), input)) });
  });
  router.post("/reports/:id/resolve", async (req, res) => {
    const input = z.object({ remove_content: z.boolean(), reason: text(2000) }).strict().parse(req.body);
    await result(req.db.rpc("resolve_report", { p_id: uuid.parse(req.params.id), p_remove_content: input.remove_content, p_reason: input.reason }));
    res.sendStatus(204);
  });
  router.get("/history", async (req, res) => {
    res.json({ data: await result(paginate(req.db.from("moderation_actions").select("*,trace:traces(id,title),actor:profiles!moderation_actions_actor_id_fkey(id,display_name)").order("created_at", { ascending: false }).order("id"), page.parse(req.query))) });
  });
  return router;
}

export function adminRoutes(gateway) {
  const router = Router();
  router.use(authenticate(gateway, { roles: ["admin"] }));
  router.get("/users", async (req, res) => {
    res.json({ data: await result(paginate(req.db.rpc("admin_list_profiles").order("created_at", { ascending: false }).order("id"), page.parse(req.query))) });
  });
  router.patch("/users/:id", async (req, res) => {
    const input = z.object({ role: z.enum(["user", "moderator", "admin"]), status: z.enum(["active", "suspended"]), reason: text(2000) }).strict().parse(req.body);
    await result(req.db.rpc("admin_set_account", { p_user_id: uuid.parse(req.params.id), p_role: input.role, p_status: input.status, p_reason: input.reason }));
    res.sendStatus(204);
  });
  router.get("/audit-logs", async (req, res) => {
    res.json({ data: await result(paginate(req.db.from("admin_audit_logs").select("*").order("created_at", { ascending: false }).order("id"), page.parse(req.query))) });
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
      if (resource === "tides") {
        const { updated_at, ...fields } = req.body || {};
        const expected = z.iso.datetime({ offset: true }).parse(updated_at);
        const rows = await result(req.db.from(resource).update(schema.parse(fields)).eq("id", uuid.parse(req.params.id)).eq("updated_at", expected).select());
        if (!rows?.length) throw new HttpError(409, "STALE_VERSION", "This lesson changed or is no longer available. Reload it before retrying.");
        return res.json({ data: first(rows) });
      }
      res.json({ data: first(await result(req.db.from(resource).update(schema.parse(req.body)).eq("id", uuid.parse(req.params.id)).select())) });
    });
  }
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
