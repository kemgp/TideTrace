import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware.js";
import { first, result } from "../errors.js";
import { coordinatePair, draft, page, paginate, report, text, uuid, version } from "../validation.js";

export const traceSelect = "*,category:categories(id,name),author:profiles!traces_author_id_fkey(id,display_name),trace_media(*)";
const publicTraces = (db) => db.from("traces").select(traceSelect).eq("status", "approved").eq("is_hidden", false).is("deleted_at", null);

export function contentRoutes(gateway) {
  const router = Router();
  const member = authenticate(gateway);
  const send = (res, data, status = 200) => res.status(status).json({ data });
  router.get("/categories", async (req, res) => {
    send(res, await result(req.db.from("categories").select("*").eq("is_active", true).order("name")));
  });
  router.get("/traces", async (req, res) => {
    const query = page.extend({ category_id: uuid.optional() }).parse(req.query);
    let feed = publicTraces(req.db).order("published_at", { ascending: false }).order("id");
    if (query.category_id) feed = feed.eq("category_id", query.category_id);
    send(res, await result(paginate(feed, query)));
  });
  router.get("/traces/:id", async (req, res) => {
    // Always a public detail; private submissions have a separate member route.
    send(res, first(await result(publicTraces(req.db).eq("id", uuid.parse(req.params.id)).limit(1))));
  });
  router.get("/traces/:id/comments", async (req, res) => {
    const id = uuid.parse(req.params.id);
    const pagination = page.parse(req.query);
    first(await result(publicTraces(req.db).eq("id", id).limit(1)));
    send(res, await result(paginate(req.db.from("comments").select("*,author:profiles!comments_author_id_fkey(id,display_name)")
      .eq("trace_id", id).eq("status", "visible").order("created_at").order("id"), pagination)));
  });
  router.get("/tides", async (req, res) => {
    send(res, await result(paginate(req.db.from("tides").select("*").eq("status", "published").order("published_at", { ascending: false }).order("id"), page.parse(req.query))));
  });
  router.get("/tides/:id", async (req, res) => {
    send(res, first(await result(req.db.from("tides").select("*").eq("status", "published").eq("id", uuid.parse(req.params.id)).limit(1))));
  });
  router.patch("/profile", member, async (req, res) => {
    const body = z.object({ display_name: text(100) }).strict().parse(req.body);
    send(res, first(await result(req.db.from("profiles").update(body).eq("id", req.user.id).select("id,display_name"))));
  });
  router.get("/contributions", member, async (req, res) => {
    send(res, await result(paginate(req.db.from("traces").select(traceSelect).eq("author_id", req.user.id).order("created_at", { ascending: false }).order("id"), page.parse(req.query))));
  });
  router.get("/contributions/:id", member, async (req, res) => {
    send(res, first(await result(req.db.from("traces").select(traceSelect).eq("author_id", req.user.id).eq("id", uuid.parse(req.params.id)).limit(1))));
  });
  async function saveDraft(req, res, creating) {
    const schema = creating ? draft : draft.extend({ version });
    const input = schema.refine(coordinatePair, { message: "Provide both coordinates or neither" }).parse(req.body);
    send(res, await result(req.db.rpc("save_trace_draft", {
      p_id: creating ? null : uuid.parse(req.params.id), p_version: creating ? null : input.version,
      p_title: input.title, p_description: input.description, p_category_id: input.category_id,
      p_location_name: input.location_name, p_latitude: input.latitude, p_longitude: input.longitude,
    })), creating ? 201 : 200);
  }
  router.post("/traces", member, (req, res) => saveDraft(req, res, true));
  router.put("/traces/:id", member, (req, res) => saveDraft(req, res, false));
  router.post("/traces/:id/submit", member, async (req, res) => {
    const input = z.object({ version }).strict().parse(req.body);
    send(res, await result(req.db.rpc("submit_trace", { p_id: uuid.parse(req.params.id), p_version: input.version })));
  });
  router.post("/traces/:id/comments", member, async (req, res) => {
    const input = z.object({ body: text(5000) }).strict().parse(req.body);
    send(res, first(await result(req.db.from("comments").insert({ ...input, trace_id: uuid.parse(req.params.id) }).select())), 201);
  });
  router.post("/reports", member, async (req, res) => {
    send(res, first(await result(req.db.from("reports").insert(report.parse(req.body)).select())), 201);
  });
  router.get("/reports", member, async (req, res) => {
    send(res, await result(paginate(req.db.from("reports").select("*").eq("reporter_id", req.user.id).order("created_at", { ascending: false }).order("id"), page.parse(req.query))));
  });
  router.get("/notifications", member, async (req, res) => {
    send(res, await result(paginate(req.db.from("notifications").select("*").eq("recipient_id", req.user.id).order("created_at", { ascending: false }).order("id"), page.parse(req.query))));
  });
  router.post("/notifications/read", member, async (req, res) => {
    const input = z.object({ ids: z.array(uuid).min(1).max(100).nullable() }).strict().parse(req.body);
    await result(req.db.rpc("mark_notifications_read", { p_ids: input.ids }));
    res.sendStatus(204);
  });
  return router;
}
