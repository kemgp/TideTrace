import { ApiError } from "./auth.js";

export function getData(path, options) {
  return requestData(path, options);
}

export async function requestData(path, { token, signal, method = "GET", body, file } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  const timeout = setTimeout(abort, file ? 120000 : 20000);
  try {
    const response = await fetch(`/api/${path}`, {
      method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(file ? { "Content-Type": file.type } : body !== undefined ? { "Content-Type": "application/json" } : {}) },
      ...(file ? { body: file } : body !== undefined ? { body: JSON.stringify(body) } : {}), signal: controller.signal, cache: "no-store",
    });
    if (response.status === 204 && response.ok) return null;
    let payload;
    try { payload = await response.json(); }
    catch { throw new ApiError("The service is unavailable. Please try again.", "INVALID_RESPONSE", response.status); }
    if (!response.ok) {
      const error = new ApiError(payload?.error?.message || "Unable to complete this request.", payload?.error?.code, response.status);
      error.details = payload?.error?.details;
      throw error;
    }
    if (!payload || !Object.hasOwn(payload, "data")) throw new ApiError("The service returned an unexpected response.", "INVALID_RESPONSE");
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
