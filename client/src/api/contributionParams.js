// My Contributions keeps its status filter and page in the URL so reload and Back return to the same view.
export const CONTRIBUTION_FILTERS = ["All", "draft", "pending", "approved", "revision", "rejected"];

export function readContributionParams(params) {
  const status = params.get("status");
  const rawPage = params.get("page") || "1";
  const page = Number.parseInt(rawPage, 10);
  return {
    status: CONTRIBUTION_FILTERS.includes(status) && status !== "All" ? status : "All",
    page: /^\d+$/.test(rawPage) && page >= 1 && page <= 10000 ? page : 1,
  };
}

export function writeContributionParams(state) {
  const params = new URLSearchParams();
  if (state.status !== "All") params.set("status", state.status);
  if (state.page !== 1) params.set("page", String(state.page));
  return params;
}

export function contributionSearch(state) {
  const search = writeContributionParams(state).toString();
  return search ? `?${search}` : "";
}

export function safeContributionSearch(value) {
  if (typeof value !== "string" || !value.startsWith("?")) return "";
  return contributionSearch(readContributionParams(new URLSearchParams(value))) === value ? value : "";
}
