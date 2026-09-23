import { ApiError } from "./auth.js";

export async function getData(path, { token, signal } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  const timeout = setTimeout(abort, 20000);
  try {
    const response = await fetch(`/api/${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal, cache: "no-store" });
    let payload;
    try { payload = await response.json(); }
    catch { throw new ApiError("The service is unavailable. Please try again.", "INVALID_RESPONSE", response.status); }
    if (!response.ok) throw new ApiError(payload.error?.message || "Unable to load this data.", payload.error?.code, response.status);
    if (!Object.hasOwn(payload, "data")) throw new ApiError("The service returned an unexpected response.", "INVALID_RESPONSE");
    return payload.data;
  } catch (error) {
    if (signal?.aborted) throw new ApiError("Request cancelled.", "CANCELLED");
    if (error instanceof ApiError) throw error;
    throw new ApiError(controller.signal.aborted ? "The request timed out. Please try again." : "Unable to load data. Check your connection and try again.", "NETWORK_ERROR");
  } finally { clearTimeout(timeout); signal?.removeEventListener("abort", abort); }
}

export function displayTrace(row) {
  const date = new Date(row.published_at || row.created_at);
  return { ...row, title: row.title || "Untitled draft", category: row.category?.name || "Uncategorized", author: row.author?.display_name || "Community member",
    location: row.location_name || "Location not supplied", when: Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(),
    status: row.status === "revision_requested" ? "revision" : row.status };
}
