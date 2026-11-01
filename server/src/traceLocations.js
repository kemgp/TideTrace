import { result } from "./errors.js";

// Call only from authenticated owner/staff routes; the RPC checks access again.
export async function withPrivateLocation(db, trace) {
  if (!trace.is_sensitive) return trace;
  const rows = await result(db.rpc("get_trace_private_location", { p_id: trace.id }));
  return { ...trace, latitude: rows[0]?.latitude ?? null, longitude: rows[0]?.longitude ?? null };
}
