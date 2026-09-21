import { randomUUID } from "node:crypto";
import { Router, raw } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { authenticate } from "../middleware.js";
import { HttpError, first, result } from "../errors.js";
import { uuid } from "../validation.js";

const formats = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4" };
export function matchesFileType(buffer, type) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;
  if (type === "image/jpeg") return buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (type === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === "image/webp") return buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  if (type === "video/mp4") return buffer.toString("ascii", 4, 8) === "ftyp";
  return false;
}

export function mediaRoutes(gateway) {
  const router = Router();
  const member = authenticate(gateway);
  const uploadLimit = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ error: { code: "RATE_LIMITED", message: "Upload limit reached. Try again later.", request_id: req.requestId } }),
  });
  router.post("/traces/:id/media", member, uploadLimit, (req, res, next) => {
    req.mediaType = req.get("Content-Type")?.split(";")[0].toLowerCase();
    if (!Object.hasOwn(formats, req.mediaType || "")) throw new HttpError(415, "UNSUPPORTED_MEDIA", "Upload a JPEG, PNG, WebP or MP4 as the raw request body.");
    next();
  }, raw({ type: () => true, limit: "20mb" }), async (req, res) => {
    const id = uuid.parse(req.params.id);
    const { sort_order } = z.object({ sort_order: z.coerce.number().int().min(0).max(1000).default(0) }).strict().parse(req.query);
    if (!matchesFileType(req.body, req.mediaType)) throw new HttpError(400, "INVALID_MEDIA", "The file does not match its declared content type.");
    const trace = first(await result(req.db.from("traces").select("id,author_id,status,is_hidden,deleted_at").eq("id", id).eq("author_id", req.user.id).limit(1)));
    if (!["draft", "revision_requested"].includes(trace.status) || trace.is_hidden || trace.deleted_at) throw new HttpError(403, "NOT_EDITABLE", "Only editable drafts can receive uploads.");
    const path = `${req.user.id}/${id}/${randomUUID()}.${formats[req.mediaType]}`;
    await result(req.db.storage.from("trace-media").upload(path, req.body, { contentType: req.mediaType, upsert: false }));
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
  router.get("/media/:id/url", async (req, res) => {
    // Storage SELECT and table RLS enforce public/owner/staff visibility.
    const media = first(await result(req.db.from("trace_media").select("object_path").eq("id", uuid.parse(req.params.id)).limit(1)));
    const data = await result(req.db.storage.from("trace-media").createSignedUrl(media.object_path, 60));
    res.json({ data: { url: data.signedUrl, expires_in: 60 } });
  });
  return router;
}
