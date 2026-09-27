import React from "react";
import Card from "./Card.jsx";
import "./TraceDraftLayout.css";

const STEPS = [
  { key: "category", label: "Select category", hint: "What kind of trace?" },
  { key: "location", label: "Add location", hint: "Name your coastal site" },
  { key: "description", label: "Add description", hint: "Tell your story" },
  { key: "photo", label: "Add photo", hint: "Share what you saw" },
  { key: "review", label: "Review & submit", hint: "Check your details" },
];

export default function TraceDraftLayout({ activeStep, onSelect, editing, children }) {
  return <div className={`trace-draft-layout${editing ? " trace-draft-layout--editing" : ""}`}>
    {!editing && <nav className="trace-draft-steps" aria-label="New trace steps">
      <ol>{STEPS.map((step, index) => <li key={step.key}>
        <button type="button" aria-current={activeStep === step.key ? "step" : undefined} onClick={() => onSelect(step.key)}>
          <span className="trace-draft-steps__number" aria-hidden="true">{index + 1}</span>
          <span className="trace-draft-steps__copy">{step.label}<small>{step.hint}</small></span>
        </button>
      </li>)}</ol>
    </nav>}
    <Card className="trace-draft-panel">{children}</Card>
  </div>;
}

export function TraceDraftSection({ step, onActivate, children }) {
  const index = STEPS.findIndex((item) => item.key === step);
  const title = STEPS[index].label;
  return <section className="trace-draft-section" id={`trace-step-${step}`} tabIndex={-1}
    aria-label={step === "review" ? "Review submission" : title} onFocus={() => onActivate(step)}>
    <h3 className="trace-draft-section__heading">Step {index + 1} · {title}</h3>
    {children}
  </section>;
}

export function TraceDraftSummary({ fields, categories, photo }) {
  const entries = [
    ["Category", categories.find((category) => category.id === fields.category_id)?.name || "Not selected"],
    ["Title", fields.title || "Not written"],
    ["Location", fields.location_name || "Not set"],
    ["Description", fields.description || "Not written"],
    ["Photo", photo?.name || "Not selected"],
  ];
  return <dl className="trace-draft-summary">{entries.map(([label, value]) =>
    <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
  )}</dl>;
}
