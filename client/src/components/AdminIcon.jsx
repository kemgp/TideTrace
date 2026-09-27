import React from "react";

const paths = {
  dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  shield: "M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7z",
  book: "M12 5v16 M12 5C8 2 3 3 2 3v16c4-1 7 0 10 2 3-2 6-3 10-2V3c-4-1-7 0-10 2",
  history: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 7v5l3 2",
  settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
  chart: "M4 20V10 M10 20V4 M16 20v-8 M22 20H2",
  log: "M5 3h14v18H5z M8 7h8 M8 11h8 M8 15h5",
  tag: "M3 3h8l10 10-8 8L3 11z M7 7h.01",
  key: "M14 3a7 7 0 1 1-4 13l-6 6-3-3 6-6a7 7 0 0 1 7-10 M16 7h.01",
};
export default function AdminIcon({ name, size = 18 }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name] || paths.dashboard} /></svg>;
}
