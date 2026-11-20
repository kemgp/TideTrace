import { randomUUID } from "node:crypto";
import { Router, raw } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { authenticate } from "../middleware.js";
import { HttpError, first, result, upstreamError } from "../errors.js";
import { uuid } from "../validation.js";
import { cleanupProfilePhotos } from "../profilePhotos.js";

const formats = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4" };
// Every upload gets a new random path and is never overwritten, so browsers may keep it for a year.
// How long a browser can actually reuse it still depends on the signed link it was loaded from.
const CACHE_SECONDS = "31536000";
// Trace evidence: photos arrive compressed by the browser; videos are not compressed, so cap them here.
const TRACE_UPLOAD_LIMIT = "8mb";
export function matchesFileType(buffer, type) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;
  if (type === "image/jpeg") return buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (type === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === "image/webp") return buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  if (type === "video/mp4") return buffer.toString("ascii", 4, 8) === "ftyp";
  if (type === "application/pdf") return buffer.toString("ascii", 0, 5) === "%PDF-";
  return false;
}

export function mediaRoutes(gateway) {
  const router = Router();
  const member = authenticate(gateway);
  const admin = authenticate(gateway, { roles: ["admin"] });
  const uploadLimit = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ error: { code: "RATE_LIMITED", message: "Upload limit reached. Try again later.", request_id: req.requestId } }),
  });
  router.post("/profile/photo/cleanup", member, uploadLimit, async (req, res) => {
    z.object({}).strict().parse(req.body || {});
    res.json({ data: { removed: await cleanupProfilePhotos(req.db) } });
  });
  router.delete("/profile/photo", member, uploadLimit, async (req, res) => {
    z.object({}).strict().parse(req.body || {});
    const saved = await result(req.db.rpc("remove_profile_photo"));
    res.json({ data: { id: saved.id, avatar_path: saved.avatar_path } });
  });
  router.post("/profile/photo", member, uploadLimit, (req, res, next) => {
    req.mediaType = req.get("Content-Type")?.split(";")[0].toLowerCase();
    if (!["image/jpeg", "image/png", "image/webp"].includes(req.mediaType)) throw new HttpError(415, "UNSUPPORTED_MEDIA", "Choose a JPEG, PNG or WebP photo.");
    next();
  }, raw({ type: () => true, limit: "5mb" }), async (req, res) => {
    if (!matchesFileType(req.body, req.mediaType)) throw new HttpError(400, "INVALID_MEDIA", "The file does not match its declared content type.");
    const path = `${req.user.id}/${randomUUID()}.${formats[req.mediaType]}`;
    await result(req.db.storage.from("profile-photos").upload(path, req.body, { contentType: req.mediaType, upsert: false, cacheControl: CACHE_SECONDS }));
    const saved = await result(req.db.rpc("set_profile_photo", { p_object_path: path }));
    res.status(201).json({ data: { id: saved.id, avatar_path: saved.avatar_path } });
  });
  router.post("/traces/:id/media", member, uploadLimit, (req, res, next) => {
    req.mediaType = req.get("Content-Type")?.split(";")[0].toLowerCase();
    if (!Object.hasOwn(formats, req.mediaType || "")) throw new HttpError(415, "UNSUPPORTED_MEDIA", "Upload a JPEG, PNG, WebP or MP4 as the raw request body.");
    next();
  }, raw({ type: () => true, limit: TRACE_UPLOAD_LIMIT }), async (req, res) => {
    const id = uuid.parse(req.params.id);
    const { sort_order } = z.object({ sort_order: z.coerce.number().int().min(0).max(1000).default(0) }).strict().parse(req.query);
    if (!matchesFileType(req.body, req.mediaType)) throw new HttpError(400, "INVALID_MEDIA", "The file does not match its declared content type.");
    const trace = first(await result(req.db.from("traces").select("id,author_id,status,is_hidden,deleted_at").eq("id", id).eq("author_id", req.user.id).limit(1)));
    if (!["draft", "revision_requested"].includes(trace.status) || trace.is_hidden || trace.deleted_at) throw new HttpError(403, "NOT_EDITABLE", "Only editable drafts can receive uploads.");
    const path = `${req.user.id}/${id}/${randomUUID()}.${formats[req.mediaType]}`;
    await result(req.db.storage.from("trace-media").upload(path, req.body, { contentType: req.mediaType, upsert: false, cacheControl: CACHE_SECONDS }));
    let media;
    try {
      media = await result(req.db.rpc("attach_trace_media", { p_trace_id: id, p_object_path: path, p_sort_order: sort_order }));
    } catch (error) {
      // Storage and Postgres are separate transactions. Preserve a retryable path.
      throw new HttpError(error.status || 502, "MEDIA_ATTACH_FAILED", "File uploaded but could not be attached. Reload the draft before retrying attachment.", { object_path: path });
    }
    res.status(201).json({ data: media });
  });
  router.post("/traces/:id/media/attach", member, async (req, res) => {
    const id = uuid.parse(req.params.id);
    const input = z.object({ object_path: z.string().max(500), sort_order: z.number().int().min(0).max(1000).default(0) }).strict().parse(req.body);
    const parts = input.object_path.split("/");
    if (parts.length !== 3 || parts[0] !== req.user.id || parts[1] !== id || !/^[0-9a-f-]+\.(jpg|png|webp|mp4)$/.test(parts[2])) throw new HttpError(400, "INVALID_MEDIA_PATH", "Use an upload path returned for your own draft.");
    res.status(201).json({ data: await result(req.db.rpc("attach_trace_media", { p_trace_id: id, p_object_path: input.object_path, p_sort_order: input.sort_order })) });
  });
  router.delete("/media/:id", member, async (req, res) => {
    await result(req.db.rpc("detach_trace_media", { p_media_id: uuid.parse(req.params.id) }));
    res.sendStatus(204);
  });
  // Table RLS and the Storage SELECT policy decide who may see a file (public, owner or staff).
  const readableMedia = async (req) => first(await result(req.db.from("trace_media")
    .select("object_path,mime_type,thumb_path,display_path,trace:traces!inner(status,is_hidden,deleted_at)")
    .is("trace.deleted_at", null).eq("id", uuid.parse(req.params.id)).limit(1)));
  // Which file to send: ?size=thumb (cards, lists) is the 480 px copy; otherwise (the Trace page) the 1600 px
  // display copy. Each falls back to the next larger file that exists, ending at the original. Copies are made
  // at upload or by scripts/backfill-media-variants.mjs; the original itself is never changed.
  const sizeQuery = z.object({ size: z.enum(["thumb", "display"]).optional() }).strict();
  const pick = (media, size) => {
    const path = size === "thumb" ? media.thumb_path || media.display_path || media.object_path
      : media.display_path || media.object_path;
    return { path, type: path === media.object_path ? media.mime_type : "image/webp" };
  };
  const isPublic = (media) => media.trace?.status === "approved" && media.trace?.is_hidden === false && !media.trace?.deleted_at;
  // Photos of approved, visible Traces get a signed link that stays the same for up to an hour, so the
  // browser reuses the download. Anything else (draft, pending, held, hidden) gets no link at all:
  // the client fetches the file itself from /media/:id/file, so nothing shareable leaves the API.
  router.get("/media/:id/url", async (req, res) => {
    const { size } = sizeQuery.parse(req.query);
    const media = await readableMedia(req);
    if (!isPublic(media)) return res.json({ data: { url: null, private: true } });
    const link = await gateway.links.one(req.db, "trace-media", pick(media, size).path);
    res.json({ data: { url: link.url, expires_in: link.expiresIn } });
  });
  router.get("/media/:id/file", async (req, res) => {
    const { size } = sizeQuery.parse(req.query);
    const media = await readableMedia(req);
    const chosen = pick(media, size);
    // Downloaded with the caller's token, so the Storage policy checks access a second time.
    const file = await result(req.db.storage.from("trace-media").download(chosen.path));
    res.set({ "Content-Type": chosen.type, "Content-Disposition": "inline", "Cache-Control": "private, no-store" });
    res.send(Buffer.from(await file.arrayBuffer()));
  });
  // The browser sends a 480 px WebP right after a photo is added to a draft. It is stored beside the original
  // (<name>.thumb.webp) and attached by set_trace_media_thumb, which checks the author and the draft.
  router.post("/media/:id/thumb", member, (req, res, next) => {
    req.mediaType = req.get("Content-Type")?.split(";")[0].toLowerCase();
    if (req.mediaType !== "image/webp") throw new HttpError(415, "UNSUPPORTED_MEDIA", "Send the thumbnail as a WebP image.");
    next();
  }, raw({ type: () => true, limit: "512kb" }), async (req, res) => {
    const id = uuid.parse(req.params.id);
    if (!matchesFileType(req.body, "image/webp")) throw new HttpError(400, "INVALID_MEDIA", "The file does not match its declared content type.");
    const media = first(await result(req.db.from("trace_media").select("object_path").eq("id", id).limit(1)));
    const path = `${media.object_path.replace(/\.[a-z0-9]+$/, "")}.thumb.webp`;
    const { error } = await req.db.storage.from("trace-media").upload(path, req.body, { contentType: "image/webp", upsert: false, cacheControl: CACHE_SECONDS });
    // A retry after an uncertain response finds the file already there; attaching it again is safe.
    if (error && !/exist|duplicate/i.test(`${error.message} ${error.error || ""}`)) throw upstreamError(error);
    res.status(201).json({ data: await result(req.db.rpc("set_trace_media_thumb", { p_media_id: id, p_thumb_path: path })) });
  });
  // Tide lesson files (cover image and PDF slides). Admin uploads; everyone reads through signed URLs.
  const tideAsset = {
    cover: { types: ["image/jpeg", "image/png", "image/webp"], limit: "5mb", label: "Choose a JPEG, PNG or WebP cover image." },
    slides: { types: ["application/pdf"], limit: "25mb", label: "Upload the slides as a PDF." },
  };
  const tideExt = { ...formats, "application/pdf": "pdf" };
  for (const kind of Object.keys(tideAsset)) {
    const rule = tideAsset[kind];
    router.post(`/tides/:id/${kind}`, admin, uploadLimit, (req, res, next) => {
      req.mediaType = req.get("Content-Type")?.split(";")[0].toLowerCase();
      if (!rule.types.includes(req.mediaType)) throw new HttpError(415, "UNSUPPORTED_MEDIA", rule.label);
      next();
    }, raw({ type: () => true, limit: rule.limit }), async (req, res) => {
      const id = uuid.parse(req.params.id);
      const query = z.object({ pages: z.coerce.number().int().min(1).max(500).optional() }).strict().parse(req.query);
      if (kind === "slides" && !query.pages) throw new HttpError(400, "VALIDATION_ERROR", "Enter the number of pages (1 to 500).");
      if (!matchesFileType(req.body, req.mediaType)) throw new HttpError(400, "INVALID_MEDIA", "The file does not match its declared content type.");
      first(await result(req.db.from("tides").select("id").eq("id", id).limit(1)));
      const path = `${id}/${kind}-${randomUUID()}.${tideExt[req.mediaType]}`;
      await result(req.db.storage.from("tide-assets").upload(path, req.body, { contentType: req.mediaType, upsert: false, cacheControl: CACHE_SECONDS }));
      let saved;
      try {
        saved = await result(req.db.rpc("set_tide_asset", { p_tide_id: id, p_kind: kind, p_object_path: path, p_pages: kind === "slides" ? query.pages : null }));
      } catch (error) {
        await req.db.storage.from("tide-assets").remove([path]).catch(() => {});
        throw error;
      }
      if (saved.previous_path) await req.db.storage.from("tide-assets").remove([saved.previous_path]).catch(() => {});
      res.status(201).json({ data: saved.tide });
    });
    router.delete(`/tides/:id/${kind}`, admin, uploadLimit, async (req, res) => {
      const saved = await result(req.db.rpc("clear_tide_asset", { p_tide_id: uuid.parse(req.params.id), p_kind: kind }));
      if (saved.previous_path) await req.db.storage.from("tide-assets").remove([saved.previous_path]).catch(() => {});
      res.json({ data: saved.tide });
    });
    router.get(`/tides/:id/${kind}`, async (req, res) => {
      // Table RLS and the storage policy limit this to published lessons (or admins).
      const column = kind === "cover" ? "cover_path" : "slides_path,slides_pages";
      const tide = first(await result(req.db.from("tides").select(column).eq("id", uuid.parse(req.params.id)).limit(1)));
      const objectPath = tide[`${kind}_path`];
      if (!objectPath) throw new HttpError(404, "NOT_FOUND", "Record not found.");
      const link = await gateway.links.one(req.db, "tide-assets", objectPath);
      res.json({ data: { url: link.url, expires_in: link.expiresIn, ...(kind === "slides" ? { pages: tide.slides_pages } : {}) } });
    });
  }
  // Images placed inside lesson text. Admins upload with a description (alt text); everyone reads signed links.
  const imageTypes = ["image/jpeg", "image/png", "image/webp"];
  router.post("/tides/:id/images", admin, uploadLimit, (req, res, next) => {
    req.mediaType = req.get("Content-Type")?.split(";")[0].toLowerCase();
    if (!imageTypes.includes(req.mediaType)) throw new HttpError(415, "UNSUPPORTED_MEDIA", "Choose a JPEG, PNG or WebP image.");
    next();
  }, raw({ type: () => true, limit: "5mb" }), async (req, res) => {
    const id = uuid.parse(req.params.id);
    const { alt } = z.object({ alt: z.string().trim().min(1, "Describe the image.").max(200) }).strict().parse(req.query);
    if (!matchesFileType(req.body, req.mediaType)) throw new HttpError(400, "INVALID_MEDIA", "The file does not match its declared content type.");
    first(await result(req.db.from("tides").select("id").eq("id", id).limit(1)));
    const path = `${id}/image-${randomUUID()}.${formats[req.mediaType]}`;
    await result(req.db.storage.from("tide-assets").upload(path, req.body, { contentType: req.mediaType, upsert: false, cacheControl: CACHE_SECONDS }));
    let saved;
    try {
      saved = await result(req.db.rpc("add_tide_image", { p_tide_id: id, p_object_path: path, p_alt: alt }));
    } catch (error) {
      await req.db.storage.from("tide-assets").remove([path]).catch(() => {});
      throw error;
    }
    res.status(201).json({ data: { id: saved.id, tide_id: saved.tide_id, alt: saved.alt } });
  });
  router.delete("/tides/:id/images/:imageId", admin, uploadLimit, async (req, res) => {
    const id = uuid.parse(req.params.id);
    const removed = await result(req.db.rpc("remove_tide_image", { p_image_id: uuid.parse(req.params.imageId) }));
    if (removed.tide_id !== id) throw new HttpError(404, "NOT_FOUND", "Record not found.");
    await req.db.storage.from("tide-assets").remove([removed.object_path]).catch(() => {});
    res.sendStatus(204);
  });
  router.get("/tides/:id/images", async (req, res) => {
    z.object({}).strict().parse(req.query);
    // Table RLS limits this to published lessons (or admins).
    const rows = await result(req.db.from("tide_images").select("id,alt,object_path").eq("tide_id", uuid.parse(req.params.id)).order("created_at").order("id").limit(100));
    let urls = new Map();
    if (rows.length) {
      try { urls = await gateway.links.many(req.db, "tide-assets", rows.map((row) => row.object_path)); }
      catch { /* the lesson shows the descriptions instead */ }
    }
    res.json({ data: rows.map((row) => ({ id: row.id, alt: row.alt, url: urls.get(row.object_path) || null })) });
  });
  return router;
}
