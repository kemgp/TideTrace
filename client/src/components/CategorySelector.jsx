import React from "react";

export default function CategorySelector({ categories, value, onChange }) {
  return (
    <div className="chiprow">
      {categories.map((cat) => (
        <button
          key={cat}
          type="button"
          className={`chip ${value === cat ? "on" : ""}`}
          onClick={() => onChange(cat)}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
