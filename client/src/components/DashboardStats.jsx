import React from "react";
import RemoteState from "./RemoteState.jsx";

export default function DashboardStats({ result, items, usage = false }) {
  return <section aria-label={usage ? "Usage totals" : "Dashboard totals"} style={{ marginTop: 16 }}>
    <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
      {result.data && <p className="hint">{`Updated ${new Date(result.data.as_of).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}</p>}
      <button className="btn outline sm" onClick={result.refresh}>Refresh totals</button>
    </div>
    {result.error && <RemoteState compact {...result} />}
    <div className={usage ? "" : items.length === 3 ? "g3" : "g4"} aria-busy={result.loading}>
      {items.map(([key, label]) => <div className={usage ? "setrow" : "stat"} key={key}>
        {usage && <div className="l">{label}</div>}
        <b>{result.loading ? <span className="stat-placeholder" aria-label={`Loading ${label}`} /> : result.data ? result.data[key] : "—"}</b>
        {!usage && <span>{label}</span>}
      </div>)}
    </div>
  </section>;
}
