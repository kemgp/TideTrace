import React from "react";

/**
 * Generic button matching the design system's .btn variants.
 * variant: "blue" (primary) | "clay" (contribute accent) | "outline" | "ghost" | "danger" | "teal" (deprecated)
 */
export default function Button({ variant = "blue", size, children, className = "", ...rest }) {
  const cls = ["btn", variant, size === "sm" ? "sm" : "", className].filter(Boolean).join(" ");
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}
