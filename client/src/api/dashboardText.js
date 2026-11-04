const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

// The one-sentence status under the greeting. `summary` is the /dashboard payload, or null while it loads.
// When something needs action the hero shows `attentionLink` instead, so this only covers the quiet states.
export function attentionLine(summary) {
  if (!summary) return "Your traces and lessons at a glance.";
  const revisions = summary.needs_revision || 0;
  const drafts = summary.drafts || 0;
  const parts = [];
  if (revisions) parts.push(plural(revisions, "revision request", "revision requests"));
  if (drafts) parts.push(plural(drafts, "draft", "drafts"));
  if (parts.length) return `${parts.join(" and ")} ${parts.length === 1 && revisions + drafts === 1 ? "needs" : "need"} your attention.`;
  return summary.traces ? "You're all caught up." : "Share your first trace.";
}

// Short text for the link in the hero that jumps to "Needs your attention", or "" when nothing needs action.
export function attentionLink(summary) {
  const revisions = summary?.needs_revision || 0;
  const drafts = summary?.drafts || 0;
  if (revisions) return `Fix ${plural(revisions, "revision", "revisions")} →`;
  if (drafts) return `Finish ${plural(drafts, "draft", "drafts")} →`;
  return "";
}

// Where each stat card leads in My Contributions (the status values are the ones My Contributions reads from the URL).
export const STAT_LINKS = {
  traces: "/user/contributions",
  drafts: "/user/contributions?status=draft",
  needs_revision: "/user/contributions?status=revision",
  pending: "/user/contributions?status=pending",
  approved: "/user/contributions?status=approved",
  rejected: "/user/contributions?status=rejected",
};

// One card per status, so the cards add up to the total. "Rejected" appears only when the totals report it.
export function statItems(summary) {
  const items = [
    ["traces", "Total Traces"],
    ["drafts", "Drafts"],
    ["needs_revision", "Needs revision"],
    ["pending", "In review"],
    ["approved", "Approved"],
  ];
  if (Number.isSafeInteger(summary?.rejected)) items.push(["rejected", "Rejected"]);
  return items.map(([key, label]) => [key, label, STAT_LINKS[key]]);
}

// The first lesson on the page that the member has not finished, or null.
export function nextLesson(lessons, completions) {
  const done = new Set((completions || []).map((record) => record.tide_id));
  return (lessons || []).find((lesson) => !done.has(lesson.id)) || null;
}

// What "Continue learning" shows: the unfinished lesson the member opened most recently (it has saved progress),
// otherwise the first unstarted lesson. Returns { lesson, progress } where progress is null for an unstarted lesson,
// or null when every lesson on the page is finished.
export function continueLesson(lessons, completions, progress) {
  const done = new Set((completions || []).map((record) => record.tide_id));
  const open = (lessons || []).filter((lesson) => !done.has(lesson.id));
  const byLesson = new Map();
  for (const record of progress || []) if (!byLesson.has(record.tide_id)) byLesson.set(record.tide_id, record);
  const started = open
    .map((lesson, order) => ({ lesson, record: byLesson.get(lesson.id), order }))
    .filter((item) => item.record && Number.isFinite(item.record.part) && Number.isFinite(item.record.total) && item.record.total > 0)
    // Newest activity first; records without a date keep the order the API returned them in.
    .sort((a, b) => (Date.parse(b.record.updated_at) || 0) - (Date.parse(a.record.updated_at) || 0) || a.order - b.order);
  if (started.length) return { lesson: started[0].lesson, progress: started[0].record };
  return open.length ? { lesson: open[0], progress: null } : null;
}

// How long a revision request has been waiting on the member, e.g. "Waiting on you for 31 days".
export function waitingText(since, now = Date.now()) {
  const time = new Date(since).getTime();
  if (Number.isNaN(time)) return "";
  const days = Math.max(0, Math.floor((now - time) / 86400000));
  if (days < 1) return "Waiting on you since today";
  return `Waiting on you for ${plural(days, "day", "days")}`;
}
