import React from "react";
import { Link } from "react-router-dom";
import RemoteState from "./RemoteState.jsx";

const Chevron = () => <svg className="stat-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m9 6 6 6-6 6" /></svg>;

// `items` are [key, label, link?, icon?]. A tile with a link opens the matching list and shows a chevron.
// `className` replaces the default grid class (for example the user dashboard's one-card-per-status row).
export default function DashboardStats({ result, items, usage = false, flush = false, showMeta = true, className = "" }) {
  return <section aria-label={usage ? "Usage totals" : "Dashboard totals"} style={{ marginTop: flush ? 0 : 16 }}>
    {showMeta && <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
      <p className="hint">{result.data ? `Updated ${new Date(result.data.as_of).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : result.loading ? <span className="sk" aria-hidden="true" style={{ display: "inline-block", width: 96, height: 12, borderRadius: 4 }} /> : null}</p>
      <button className="btn outline sm" style={{ marginLeft: "auto" }} onClick={result.refresh}>Refresh totals</button>
    </div>}
    {result.error && <RemoteState compact {...result} />}
    <div className={usage ? "" : className || (items.length === 3 ? "g3" : "g4")} aria-busy={result.loading}>
      {items.map(([key, label, to, icon]) => {
        const body = <>
          {icon && !usage && <i className="stat-icon" aria-hidden="true">{icon}</i>}
          {usage && <div className="l">{label}</div>}
          <b>{result.loading ? <span className="stat-placeholder" aria-label={`Loading ${label}`} /> : result.data ? result.data[key] ?? 0 : <><span aria-hidden="true">—</span><span className="sr-only">Not available</span></>}</b>
          {!usage && <span>{label}</span>}
          {to && !usage && <Chevron />}
        </>;
        // With a `to`, the tile opens the matching list.
        return to && !usage ? <Link className="stat stat-link" data-stat={key} key={key} to={to}>{body}</Link> : <div className={usage ? "setrow" : "stat"} data-stat={key} key={key}>{body}</div>;
      })}
    </div>
  </section>;
}
