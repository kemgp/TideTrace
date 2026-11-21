import { result } from "./errors.js";

// Deletes the caller's removed Trace photos that are due (see 20261121000100_removed_trace_media.sql), through
// the Storage API with the caller's own token. Best effort: a failure leaves them for the next try, which is
// the next removal or the next visit to My Contributions. Returns how many files were sent for deletion.
export async function deleteDueRemovedPhotos(db) {
  try {
    const due = await result(db.rpc("removed_trace_media_due"));
    const paths = (Array.isArray(due) ? due : []).map((row) => row.object_path).filter(Boolean);
    if (paths.length) await result(db.storage.from("trace-media").remove(paths));
    return paths.length;
  } catch {
    return 0;
  }
}
