import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware.js";
import { first, result, upstreamError } from "../errors.js";
import { coordinatePair, draft, page, paginate, report, text, uuid, version } from "../validation.js";
import { withAuthorPhotos } from "../profilePhotos.js";
import { withPrivateLocation } from "../traceLocations.js";

export const reviewSelect = "id,from_state,to_state,reason,created_at";
export const traceSelect = "*,category:categories(id,name),author:profiles!traces_author_id_fkey(id,display_name,avatar_path),trace_media(*)";
const publicTraces = (db) => db.from("traces").select(traceSelect).eq("status", "approved").eq("is_hidden", false).is("deleted_at", null);

export function contentRoutes(gateway) {
  const router = Router();
  const member = authenticate(gateway);
  const send = (res, data, status = 200) => res.status(status).json({ data });
  router.get("/community-summary", async (req, res) => {
    z.object({}).strict().parse(req.query);
    send(res, await result(req.db.rpc("get_community_summary")));
  });
  router.get("/dashboard", member, async (req, res) => {
    z.object({}).strict().parse(req.query);
    send(res, await result(req.db.rpc("get_dashboard_summary")));
  });
  router.get("/categories", async (req, res) => {
    send(res, await result(req.db.from("categories").select("*").eq("is_active", true).order("name")));
  });
  router.get("/traces", async (req, res) => {
    const query = page.extend({ category_id: uuid.optional(), q: z.string().trim().max(200).optional() }).parse(req.query);
    let feed = (query.q ? req.db.rpc("search_public_traces", { p_query: query.q }).select(traceSelect) : publicTraces(req.db))
      .order("published_at", { ascending: false }).order("id");
    if (query.category_id) feed = feed.eq("category_id", query.category_id);
    send(res, await withAuthorPhotos(req.db, await result(paginate(feed, query))));
  });
  router.get("/traces/map", async (req, res) => {
    const number = (min, max) => z.string().trim().min(1).pipe(z.coerce.number().min(min).max(max));
    const query = z.object({ south: number(-90, 90), north: number(-90, 90), west: number(-180, 180), east: number(-180, 180),
      q: z.string().trim().max(200).optional(), category_id: uuid.optional(),
    }).strict().refine((value) => value.south <= value.north, { message: "South must not exceed north" }).parse(req.query);
    const fields = "id,title,category_id,category:categories(id,name),location_name,latitude,longitude";
    let feed = (query.q ? req.db.rpc("search_public_traces", { p_query: query.q }) : req.db.from("traces"))
      .select(fields).eq("status", "approved").eq("is_hidden", false).is("deleted_at", null).eq("is_sensitive", false)
      .not("latitude", "is", null).not("longitude", "is", null).gte("latitude", query.south).lte("latitude", query.north);
    feed = query.west <= query.east ? feed.gte("longitude", query.west).lte("longitude", query.east)
      : feed.or(`longitude.gte.${query.west},longitude.lte.${query.east}`);
    if (query.category_id) feed = feed.eq("category_id", query.category_id);
    const rows = await result(feed.order("published_at", { ascending: false }).order("id").limit(501));
    send(res, { pins: rows.slice(0, 500), truncated: rows.length > 500 });
  });
  router.get("/traces/:id", async (req, res) => {
    // Always a public detail; private submissions have a separate member route.
    const row = first(await result(publicTraces(req.db).eq("id", uuid.parse(req.params.id)).limit(1)));
    send(res, (await withAuthorPhotos(req.db, [row]))[0]);
  });
  router.get("/traces/:id/comments", async (req, res) => {
    const id = uuid.parse(req.params.id);
    const pagination = page.parse(req.query);
    first(await result(publicTraces(req.db).eq("id", id).limit(1)));
    const rows = await result(paginate(req.db.from("comments").select("*,author:profiles!comments_author_id_fkey(id,display_name,avatar_path)")
      .eq("trace_id", id).eq("status", "visible").order("created_at").order("id"), pagination));
    send(res, await withAuthorPhotos(req.db, rows));
  });
  router.get("/tides", async (req, res) => {
    send(res, await result(paginate(req.db.from("tides").select("*").eq("status", "published").order("published_at", { ascending: false }).order("id"), page.parse(req.query))));
  });
  router.get("/tides/:id", async (req, res) => {
    send(res, first(await result(req.db.from("tides").select("*").eq("status", "published").eq("id", uuid.parse(req.params.id)).limit(1))));
  });
  router.get("/tide-completions", member, async (req, res) => {
    const query = page.extend({ tide_ids: z.string().transform((value) => value.split(",")).pipe(z.array(uuid).min(1).max(25)).optional() }).parse(req.query);
    let records = req.db.from("tide_completions").select("tide_id,completed_at").eq("user_id", req.user.id);
    if (query.tide_ids) records = records.in("tide_id", query.tide_ids);
    send(res, await result(paginate(records.order("completed_at", { ascending: false }).order("tide_id"), query)));
  });
  router.put("/tides/:id/completion", member, async (req, res) => {
    const tideId = uuid.parse(req.params.id);
    first(await result(req.db.from("tides").select("id").eq("status", "published").eq("id", tideId).limit(1)));
    const existingRows = await result(req.db.from("tide_completions").select("user_id,tide_id,completed_at").eq("user_id", req.user.id).eq("tide_id", tideId).limit(1));
    const existing = existingRows[0];
    if (existing) return send(res, existing);
    const inserted = await req.db.from("tide_completions").insert({ user_id: req.user.id, tide_id: tideId }).select("user_id,tide_id,completed_at");
    // Another request may have completed the same lesson after our read.
    if (inserted.error?.code === "23505") {
      return send(res, first(await result(req.db.from("tide_completions").select("user_id,tide_id,completed_at").eq("user_id", req.user.id).eq("tide_id", tideId).limit(1))));
    }
    if (inserted.error) throw upstreamError(inserted.error);
    send(res, first(inserted.data), 201);
  });
  router.patch("/profile", member, async (req, res) => {
    const body = z.object({ display_name: text(100) }).strict().parse(req.body);
    send(res, first(await result(req.db.from("profiles").update(body).eq("id", req.user.id).select("id,display_name"))));
  });
  router.patch("/profile/data-saver", member, async (req, res) => {
    const body = z.object({ data_saver: z.boolean() }).strict().parse(req.body);
    send(res, await result(req.db.rpc("set_data_saver", { p_enabled: body.data_saver })));
  });
  router.get("/contributions", member, async (req, res) => {
    const query = page.extend({ status: z.enum(["draft", "pending", "approved", "revision_requested", "rejected"]).optional() }).parse(req.query);
    let contributions = req.db.from("traces").select(traceSelect).eq("author_id", req.user.id);
    if (query.status) contributions = contributions.eq("status", query.status);
    const rows = await result(paginate(contributions.order("created_at", { ascending: false }).order("id"), query));
    send(res, await withAuthorPhotos(req.db, rows));
  });
  router.get("/contributions/:id", member, async (req, res) => {
    const row = first(await result(req.db.from("traces").select(traceSelect).eq("author_id", req.user.id).eq("id", uuid.parse(req.params.id)).limit(1)));
    send(res, await withPrivateLocation(req.db, (await withAuthorPhotos(req.db, [row]))[0]));
  });
  router.get("/contributions/:id/reviews", member, async (req, res) => {
    const id = uuid.parse(req.params.id);
    const pagination = page.parse(req.query);
    first(await result(req.db.from("traces").select("id").eq("id", id).eq("author_id", req.user.id).limit(1)));
    send(res, await result(paginate(req.db.from("moderation_actions").select(reviewSelect).eq("trace_id", id).eq("action", "review_trace").order("created_at", { ascending: false }).order("id", { ascending: false }), pagination)));
  });
  async function saveDraft(req, res, creating) {
    const schema = creating ? draft : draft.extend({ version });
    const input = schema.refine(coordinatePair, { message: "Provide both coordinates or neither" }).parse(req.body);
    const saved = await result(req.db.rpc("save_trace_draft", {
      p_id: creating ? null : uuid.parse(req.params.id), p_version: creating ? null : input.version,
      p_title: input.title, p_description: input.description, p_category_id: input.category_id,
      p_location_name: input.location_name, p_latitude: input.latitude, p_longitude: input.longitude,
      ...(input.is_sensitive === undefined ? {} : { p_is_sensitive: input.is_sensitive }),
    }));
    send(res, await withPrivateLocation(req.db, saved), creating ? 201 : 200);
  }
  router.post("/traces", member, (req, res) => saveDraft(req, res, true));
  router.put("/traces/:id", member, (req, res) => saveDraft(req, res, false));
  router.post("/traces/:id/hide-location", member, async (req, res) => {
    const input = z.object({ version }).strict().parse(req.body);
    const saved = await result(req.db.rpc("hide_trace_location", { p_id: uuid.parse(req.params.id), p_version: input.version }));
    send(res, await withPrivateLocation(req.db, saved));
  });
  router.post("/traces/:id/submit", member, async (req, res) => {
    const input = z.object({ version }).strict().parse(req.body);
    const saved = await result(req.db.rpc("submit_trace", { p_id: uuid.parse(req.params.id), p_version: input.version }));
    send(res, await withPrivateLocation(req.db, saved));
  });
  router.post("/traces/:id/comments", member, async (req, res) => {
    const input = z.object({ body: text(5000) }).strict().parse(req.body);
    send(res, first(await result(req.db.from("comments").insert({ ...input, trace_id: uuid.parse(req.params.id) }).select())), 201);
  });
  router.post("/reports", member, async (req, res) => {
    send(res, first(await result(req.db.from("reports").insert(report.parse(req.body)).select())), 201);
  });
  router.get("/reports", member, async (req, res) => {
    const input = page.extend({ trace_id: uuid.optional(), comment_id: uuid.optional(), status: z.enum(["open", "resolved", "dismissed"]).optional() }).parse(req.query);
    let query = req.db.from("reports").select("*").eq("reporter_id", req.user.id);
    for (const field of ["trace_id", "comment_id", "status"]) if (input[field]) query = query.eq(field, input[field]);
    send(res, await result(paginate(query.order("created_at", { ascending: false }).order("id"), input)));
  });
  router.get("/notifications", member, async (req, res) => {
    send(res, await result(paginate(req.db.from("notifications").select("*").eq("recipient_id", req.user.id).order("created_at", { ascending: false }).order("id"), page.parse(req.query))));
  });
  router.get("/notification-preferences", member, async (req, res) => {
    z.object({}).strict().parse(req.query);
    send(res, await result(req.db.rpc("get_notification_preferences")));
  });
  router.patch("/notification-preferences", member, async (req, res) => {
    const input = z.object({ key: z.enum(["submission_updates", "trace_comments", "new_tides"]), enabled: z.boolean() }).strict().parse(req.body);
    send(res, await result(req.db.rpc("set_notification_preference", { p_key: input.key, p_enabled: input.enabled })));
  });
  router.get("/notifications/unread-count", member, async (req, res) => {
    const { count, error } = await req.db.from("notifications").select("id", { count: "exact", head: true }).eq("recipient_id", req.user.id).is("read_at", null);
    if (error) throw upstreamError(error);
    send(res, { count });
  });
  router.post("/notifications/read", member, async (req, res) => {
    const input = z.object({ ids: z.array(uuid).min(1).max(100).nullable() }).strict().parse(req.body);
    await result(req.db.rpc("mark_notifications_read", { p_ids: input.ids }));
    res.sendStatus(204);
  });
  return router;
}
