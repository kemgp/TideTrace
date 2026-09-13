import React from "react";

/**
 * Generic vertical rail used for the upload wizard steps and settings tabs.
 * items: [{ key, label, hint, done }]
 */
export default function Sidebar({ items, active, onSelect }) {
  return (
    <aside className="rail">
      {items.map((item, i) => (
        <button
          key={item.key}
          type="button"
          className={`ri ${active === item.key ? "on" : ""} ${item.done ? "done" : ""}`}
          onClick={() => onSelect(item.key)}
        >
          <span className="n">{item.done ? "✓" : item.number ?? i + 1}</span>
          <span>
            {item.label}
            {item.hint && <small>{item.hint}</small>}
          </span>
        </button>
      ))}
    </aside>
  );
}
