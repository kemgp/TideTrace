import React from "react";
import { Link } from "react-router-dom";

// One calm pattern for "nothing here": say what is empty, optionally why or what next.
// `title` keeps each screen's original sentence, so it stays the text people (and tests) look for.
export default function EmptyState({ title, hint, action, card = false, className = "" }) {
  return (
    <div className={["empty-state", card ? "card" : "", className].filter(Boolean).join(" ")}>
      <span className="empty-state__mark" aria-hidden="true" />
      <p className="empty-state__title">{title}</p>
      {hint && <p className="empty-state__hint">{hint}</p>}
      {action && <Link className="btn outline sm" to={action.to}>{action.label}</Link>}
    </div>
  );
}
