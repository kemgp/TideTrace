const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

// The one-sentence status under the greeting. `summary` is the /dashboard payload, or null while it loads.
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

// Where each stat tile leads in My Contributions.
export const STAT_LINKS = { traces: "/user/contributions", approved: "/user/contributions?status=approved", pending: "/user/contributions?status=pending" };

// The first lesson on the page that the member has not finished, or null.
export function nextLesson(lessons, completions) {
  const done = new Set((completions || []).map((record) => record.tide_id));
  return (lessons || []).find((lesson) => !done.has(lesson.id)) || null;
}
