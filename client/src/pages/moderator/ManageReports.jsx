import React from "react";
import { useApp } from "../../context/AppContext.jsx";

export default function ManageReports() {
  const { reports, resolveReport, showToast } = useApp();
  const open = reports.filter((r) => r.status === "open");

  const resolve = (id, action) => {
    resolveReport(id, action);
    showToast(action === "removed" ? "Content removed" : "Report dismissed");
  };

  return (
    <div className="wrap" style={{ maxWidth: 760 }}>
      <div className="vhead">
        <span className="eyebrow teale">Manage reports</span>
        <h2>Reported content</h2>
        <p>Review each report, then dismiss it or remove the content. Reporters and owners are notified.</p>
      </div>

      {open.length ? (
        <div className="card">
          {open.map((r) => (
            <div className="lrow" key={r.id}>
              <div className="grow">
                <div className="t">{r.target}</div>
                <div className="m">Reported by {r.reporter}</div>
                <div className="flag"><b>Reason</b>{r.reason}</div>
              </div>
              <div className="act">
                <button className="mini" onClick={() => resolve(r.id, "dismissed")}>Dismiss</button>
                <button className="mini clay" onClick={() => resolve(r.id, "removed")}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="ph" style={{ marginTop: 10 }}>No open reports.</div>
      )}
    </div>
  );
}
