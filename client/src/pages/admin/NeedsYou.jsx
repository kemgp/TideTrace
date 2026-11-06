import React from "react";
import { Link } from "react-router-dom";
import { waitLabel } from "../moderator/modTools.jsx";

// One strip for the work that is waiting on an admin. Each count is a link to the place where it is handled.
// `result` is the useDashboard() result. Held Traces and the oldest wait come from totals added in
// migration 20261108000100; on an older database they are missing and the strip shows them as not available.
export default function NeedsYou({ result }) {
  const data = result.data;
  const value = (field) => result.loading ? <span className="stat-placeholder" aria-label={`Loading ${field[1]}`} /> : data && Number.isSafeInteger(data[field[0]]) ? data[field[0]] : <><span aria-hidden="true">—</span><span className="sr-only">Not available</span></>;
  const pending = data?.pending;
  const oldest = data?.oldest_pending_at ? waitLabel(data.oldest_pending_at) : "";
  const items = [
    { field: ["held_traces", "Held Traces"], to: "/admin/review?hold=only", note: "Waiting for an admin decision" },
    { field: ["open_reports", "Open reports"], to: "/admin/reports", note: "On Traces and comments" },
    { field: ["pending", "Pending Traces"], to: "/admin/review", note: pending === 0 ? "Nothing is waiting" : oldest ? `Longest wait: ${oldest.replace("Waiting ", "")}` : "Review the queue" },
  ];
  return <section className="needs-you" aria-label="Needs you">
    <h3 className="sec-t">Needs you</h3>
    <ul className="needs-you__list">
      {items.map(({ field, to, note }) => <li key={field[0]}>
        <Link className="needs-you__item" to={to} data-needs={field[0]}>
          <b>{value(field)}</b>
          <span className="needs-you__label">{field[1]}</span>
          <span className="needs-you__note">{note}</span>
        </Link>
      </li>)}
    </ul>
  </section>;
}
