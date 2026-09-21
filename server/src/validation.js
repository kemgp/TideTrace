import { z } from "zod";

export const uuid = z.uuid();
export const version = z.number().int().positive();
export const text = (max) => z.string().trim().min(1).max(max);
export const page = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
}).strict();
export const credentials = z.object({ email: z.email().max(254), password: z.string().min(1).max(128) }).strict();
export const registration = credentials.extend({ password: z.string().min(8).max(128), display_name: text(100) });
const coordinates = {
  latitude: z.number().min(-90).max(90).nullable().default(null),
  longitude: z.number().min(-180).max(180).nullable().default(null),
};
export const draft = z.object({
  title: z.string().trim().max(200), description: z.string().trim().max(20000),
  category_id: uuid, location_name: z.string().trim().max(300), ...coordinates,
}).strict();
export const coordinatePair = (input) => (input.latitude === null) === (input.longitude === null);
export const decision = z.object({
  version, decision: z.enum(["approved", "rejected", "revision_requested"]),
  reason: z.string().trim().max(2000).default(""),
}).strict().refine((input) => input.decision === "approved" || input.reason.length > 0, { message: "Feedback is required for rejection or revision" });
export const report = z.object({ trace_id: uuid.optional(), comment_id: uuid.optional(), reason: text(2000) })
  .strict().refine((input) => Boolean(input.trace_id) !== Boolean(input.comment_id), { message: "Provide exactly one trace_id or comment_id" });
export const category = z.object({ name: text(100), description: z.string().max(2000).nullable().optional(), is_active: z.boolean().optional() }).strict();
export const tide = z.object({
  title: text(200), slug: text(200).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  body: z.string().max(100000), status: z.enum(["draft", "published", "archived"]),
}).strict().refine((input) => input.status !== "published" || input.body.trim().length > 0, { message: "Published Tides need content" });
export function paginate(query, input) {
  return query.range(input.offset, input.offset + input.limit - 1);
}
