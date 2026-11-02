import React from "react";
import { Link } from "react-router-dom";
import RemoteState from "./RemoteState.jsx";

export default function DashboardStats({ result, items, usage = false, flush = false, showMeta = true }) {
  return <section aria-label={usage ? "Usage totals" : "Dashboard totals"} style={{ marginTop: flush ? 0 : 16 }}>
    {showMeta && <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
      <p className="hint">{result.data ? `Updated ${new Date(result.data.as_of).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : result.loading ? <span className="sk" aria-hidden="true" style={{ display: "inline-block", width: 96, height: 12, borderRadius: 4 }} /> : null}</p>
      <button className="btn outline sm" style={{ marginLeft: "auto" }} onClick={result.refresh}>Refresh totals</button>
    </div>}
    {result.error && <RemoteState compact {...result} />}
    <div className={usage ? "" : items.length === 3 ? "g3" : "g4"} aria-busy={result.loading}>
      {items.map(([key, label, to]) => {
        const body = <>
          {usage && <div className="l">{label}</div>}
          <b>{result.loading ? <span className="stat-placeholder" aria-label={`Loading ${label}`} /> : result.data ? result.data[key] : <><span aria-hidden="true">—</span><span className="sr-only">Not available</span></>}</b>
          {!usage && <span>{label}</span>}
        </>;
        // With a `to`, the tile opens the matching list.
        return to && !usage ? <Link className="stat stat-link" key={key} to={to}>{body}</Link> : <div className={usage ? "setrow" : "stat"} key={key}>{body}</div>;
      })}
    </div>
  </section>;
}
