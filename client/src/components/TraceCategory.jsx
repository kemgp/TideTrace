import React from "react";

export function traceColor(category = "") {
  const name = category.toLowerCase();
  if (name.includes("coral")) return "var(--tan)";
  if (name.includes("pollution")) return "var(--clay)";
  if (name.includes("fisher")) return "var(--blue)";
  if (name.includes("oral")) return "var(--navy)";
  return "var(--teal)";
}
export default function TraceCategory({ category }) {
  return <span className="user-category-marker" aria-hidden="true" style={{ background: traceColor(category) }} />;
}
