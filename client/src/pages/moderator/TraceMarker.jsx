import React from "react";

export function categoryLabel(category) {
  return /coral/i.test(category) ? "Coral" : category;
}
export default function TraceMarker({ category }) {
  const colors = { Coral: "var(--tan)", Pollution: "var(--clay)", Seagrass: "var(--teal)", Mangroves: "var(--teal)", Fisheries: "var(--blue)", "Oral history": "var(--navy)", "Oral History": "var(--navy)" };
  return <span aria-hidden="true" className="mod-trace-marker" style={{ background: colors[categoryLabel(category)] || "var(--teal)" }} />;
}
