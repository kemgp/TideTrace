export const ARCHIVE_DEFAULTS = { query: "", category: "All", page: 1, view: "list" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function readArchiveParams(params) {
  const rawPage = params.get("page") || "1";
  const page = Number.parseInt(rawPage, 10);
  return {
    query: (params.get("q") || "").trim().slice(0, 200),
    category: uuid.test(params.get("category") || "") ? params.get("category") : "All",
    page: /^\d+$/.test(rawPage) && page >= 1 && page <= 10000 ? page : 1,
    view: params.get("view") === "map" ? "map" : "list",
  };
}
export function writeArchiveParams(state) {
  const params = new URLSearchParams();
  if (state.query.trim()) params.set("q", state.query.trim());
  if (state.category !== "All") params.set("category", state.category);
  if (state.page !== 1) params.set("page", String(state.page));
  if (state.view !== "list") params.set("view", state.view);
  return params;
}
export function archiveSearch(state) {
  const search = writeArchiveParams(state).toString();
  return search ? `?${search}` : "";
}
export function safeArchiveSearch(value) {
  if (typeof value !== "string" || !value.startsWith("?")) return "";
  return archiveSearch(readArchiveParams(new URLSearchParams(value))) === value ? value : "";
}
export const pageToOffset = (page, size) => (page - 1) * size;
export const offsetToPage = (offset, size) => Math.floor(offset / size) + 1;
