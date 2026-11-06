import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware.js";
import { HttpError, first, result, upstreamError } from "../errors.js";
import { coordinatePair, draft, page, paginate, report, text, uuid, version } from "../validation.js";
import { withAuthorPhotos } from "../profilePhotos.js";
import { withPrivateLocation } from "../traceLocations.js";

export const reviewSelect = "id,from_state,to_state,reason,created_at";
export const traceSelect = "*,category:categories(id,name),author:profiles!traces_author_id_fkey(id,display_name,avatar_path),trace_media(*)";
const publicTraces = (db) => db.from("traces").select(traceSelect).eq("status", "approved").eq("is_hidden", false).is("deleted_at", null);

// Cards show the cover image, so sign all covers of a page in one storage call. A failure only drops the images.
async function withCoverUrls(db, rows) {
  const paths = [...new Set(rows.map((row) => row.cover_path).filter(Boolean))];
  if (!paths.length) return rows;
  let urls = new Map();
  try {
    const { data, error } = await db.storage.from("tide-assets").createSignedUrls(paths, 3600);
    if (!error) urls = new Map((data || []).filter((item) => !item.error && item.signedUrl).map((item) => [item.path, item.signedUrl]));
  } catch { /* fall back to the colour block */ }
  return rows.map((row) => ({ ...row, image_url: urls.get(row.cover_path) || null }));
}

// A revision request carries the reviewer's note. The list adds the latest one (and when it was sent) to each
// revision_requested row as `reviewer_note` and `revision_requested_at`. If the lookup fails the list still loads without them.
export async function withReviewerNotes(db, rows) {
  const ids = rows.filter((row) => row.status === "revision_requested").map((row) => row.id);
  if (!ids.length) return rows;
  const latest = new Map();
  try {
    const actions = await result(db.from("moderation_actions").select("trace_id,reason,created_at").in("trace_id", ids)
      .eq("action", "review_trace").eq("to_state", "revision_requested").order("created_at", { ascending: false }).order("id", { ascending: false }));
    for (const action of actions) if (!latest.has(action.trace_id)) latest.set(action.trace_id, action);
  } catch { /* the rows are still useful without the note */ }
  return rows.map((row) => {
    const action = latest.get(row.id);
    return action ? { ...row, reviewer_note: action.reason || "", revision_requested_at: action.created_at } : row;
  });
}

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
  router.get("/traces/:id/neighbors", async (req, res) => {
    const id = uuid.parse(req.params.id);
    first(await result(publicTraces(req.db).eq("id", id).limit(1)));
    const rows = await result(req.db.rpc("trace_neighbors", { p_trace_id: id }));
    const neighbors = { newer: null, older: null };
    for (const { direction, id, title } of rows) if (direction in neighbors) neighbors[direction] = { id, title };
    send(res, neighbors);
  });
  router.get("/traces/:id/related", async (req, res) => {
    const id = uuid.parse(req.params.id);
    const trace = first(await result(publicTraces(req.db).eq("id", id).limit(1)));
    const rows = await result(publicTraces(req.db).eq("category_id", trace.category_id).neq("id", id)
      .order("published_at", { ascending: false }).order("id").limit(3));
    send(res, await withAuthorPhotos(req.db, rows));
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
    const query = page.extend({
      category_id: uuid.optional(),
      q: z.string().trim().max(80).optional(),
      progress: z.enum(["completed", "incomplete"]).optional(),
    }).parse(req.query);
    let tides = req.db.from("tides").select("*,category:categories(id,name)").eq("status", "published");
    if (query.category_id) tides = tides.eq("category_id", query.category_id);
    // Strip characters that have a meaning in PostgREST filter syntax or LIKE patterns.
    const term = (query.q || "").replace(/[%_,()"\\*]/g, " ").replace(/\s+/g, " ").trim();
    if (term) tides = tides.or(`title.ilike.*${term}*,summary.ilike.*${term}*`);
    if (query.progress) {
      await member(req, res, () => {}); // throws 401 for signed-out callers
      const user = req.user;
      const done = (await result(req.db.from("tide_completions").select("tide_id").eq("user_id", user.id).limit(1000))).map((row) => row.tide_id);
      if (query.progress === "completed") tides = done.length ? tides.in("id", done) : tides.in("id", ["00000000-0000-0000-0000-000000000000"]);
      else if (done.length) tides = tides.not("id", "in", `(${done.join(",")})`);
    }
    const rows = await result(paginate(tides.order("published_at", { ascending: false }).order("id"), query));
    send(res, await withCoverUrls(req.db, rows));
  });
  router.get("/tides/:id", async (req, res) => {
    send(res, first(await result(req.db.from("tides").select("*").eq("status", "published").eq("id", uuid.parse(req.params.id)).limit(1))));
  });
  // The lesson before and after this one, in library order (newest published first, then id).
  router.get("/tides/:id/neighbors", async (req, res) => {
    z.object({}).strict().parse(req.query);
    const id = uuid.parse(req.params.id);
    const current = first(await result(req.db.from("tides").select("id,published_at").eq("status", "published").eq("id", id).limit(1)));
    if (!current.published_at) return send(res, { id, previous: null, next: null });
    const at = current.published_at;
    const published = () => req.db.from("tides").select("id,title").eq("status", "published");
    const [following, preceding] = await Promise.all([
      result(published().or(`published_at.lt.${at},and(published_at.eq.${at},id.gt.${id})`).order("published_at", { ascending: false }).order("id").limit(1)),
      result(published().or(`published_at.gt.${at},and(published_at.eq.${at},id.lt.${id})`).order("published_at", { ascending: true }).order("id", { ascending: false }).limit(1)),
    ]);
    send(res, { id, previous: preceding[0] || null, next: following[0] || null });
  });
  router.get("/tide-completions", member, async (req, res) => {
    const query = page.extend({ tide_ids: z.string().transform((value) => value.split(",")).pipe(z.array(uuid).min(1).max(25)).optional() }).parse(req.query);
    let records = req.db.from("tide_completions").select("tide_id,completed_at").eq("user_id", req.user.id);
    if (query.tide_ids) records = records.in("tide_id", query.tide_ids);
    send(res, await result(paginate(records.order("completed_at", { ascending: false }).order("tide_id"), query)));
  });
  // Where the signed-in member last stopped in a chaptered lesson.
  router.get("/tide-progress", member, async (req, res) => {
    const query = page.extend({ tide_ids: z.string().transform((value) => value.split(",")).pipe(z.array(uuid).min(1).max(25)).optional() }).parse(req.query);
    let records = req.db.from("tide_progress").select("tide_id,part,total,updated_at").eq("user_id", req.user.id);
    if (query.tide_ids) records = records.in("tide_id", query.tide_ids);
    send(res, await result(paginate(records.order("updated_at", { ascending: false }).order("tide_id"), query)));
  });
  router.put("/tides/:id/progress", member, async (req, res) => {
    const tideId = uuid.parse(req.params.id);
    const body = z.object({ part: z.number().int().min(1).max(500), total: z.number().int().min(2).max(500) }).strict()
      .refine((value) => value.part <= value.total, { message: "The chapter is outside the lesson." }).parse(req.body);
    send(res, await result(req.db.rpc("save_tide_progress", { p_tide_id: tideId, p_part: body.part, p_total: body.total })));
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
    const query = page.extend({ status: z.enum(["draft", "pending", "approved", "revision_requested", "rejected", "removed"]).optional() }).parse(req.query);
    let contributions = req.db.from("traces").select(traceSelect).eq("author_id", req.user.id).is("deleted_at", null);
    // "removed" lists Traces a moderator hid; every other view leaves them out.
    contributions = contributions.eq("is_hidden", query.status === "removed");
    if (query.status && query.status !== "removed") contributions = contributions.eq("status", query.status);
    const rows = await result(paginate(contributions.order("created_at", { ascending: false }).order("id"), query));
    send(res, await withReviewerNotes(req.db, await withAuthorPhotos(req.db, rows)));
  });
  router.get("/contributions/:id", member, async (req, res) => {
    const row = first(await result(req.db.from("traces").select(traceSelect).eq("author_id", req.user.id).is("deleted_at", null).eq("id", uuid.parse(req.params.id)).limit(1)));
    send(res, await withPrivateLocation(req.db, (await withAuthorPhotos(req.db, [row]))[0]));
  });
  router.get("/contributions/:id/reviews", member, async (req, res) => {
    const id = uuid.parse(req.params.id);
    const pagination = page.parse(req.query);
    first(await result(req.db.from("traces").select("id").eq("id", id).eq("author_id", req.user.id).is("deleted_at", null).limit(1)));
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
  async function removeStoredPhotos(db, paths, remainingPaths) {
    if (!paths.length) return;
    try {
      await result(db.storage.from("trace-media").remove(paths.map((item) => item.object_path)));
      // Storage can report success without deleting objects excluded by RLS.
      if ((await remainingPaths()).length) throw new Error("Photos remain in storage");
    } catch {
      throw new HttpError(502, "TRACE_PHOTO_CLEANUP_FAILED", "The trace is deleted, but its photos could not be removed. Retry photo removal.");
    }
  }
  async function deleteTrace(req, res, cleanupOnly = false) {
    const id = uuid.parse(req.params.id);
    const paths = await result(req.db.rpc(cleanupOnly ? "deleted_trace_media" : "delete_own_trace", { p_trace_id: id }));
    await removeStoredPhotos(req.db, paths, () => result(req.db.rpc("deleted_trace_media", { p_trace_id: id })));
    res.sendStatus(204);
  }
  router.delete("/traces/:id", member, (req, res) => deleteTrace(req, res));
  // Retry only the irreversible deletion's unfinished Storage step.
  router.post("/traces/:id/photo-cleanup", member, (req, res) => deleteTrace(req, res, true));
  // Finishes any interrupted photo removal for all of the caller's deleted Traces.
  router.post("/contributions/photo-cleanup", member, async (req, res) => {
    const pending = () => result(req.db.rpc("deleted_trace_media_pending"));
    await removeStoredPhotos(req.db, await pending(), pending);
    res.sendStatus(204);
  });
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
  router.delete("/comments/:id", member, async (req, res) => {
    await result(req.db.rpc("delete_own_comment", { p_comment_id: uuid.parse(req.params.id) }));
    res.sendStatus(204);
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
