import React from "react";

/**
 * Generic button matching the design system's .btn variants.
 * variant: "blue" (primary) | "clay" (contribute accent) | "outline" | "ghost" | "danger"
 * loading: shows a spinner, sets aria-busy and disables the button while a request runs.
 * For a plain <button className="btn ...">, set aria-busy="true" and disabled for the same look.
 */
export default function Button({ variant = "blue", size, loading = false, disabled, children, className = "", ...rest }) {
  const cls = ["btn", variant, size === "sm" ? "sm" : "", className].filter(Boolean).join(" ");
  return (
    <button className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <span className="button-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
