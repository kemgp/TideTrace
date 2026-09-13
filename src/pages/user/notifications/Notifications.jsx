import React, { useMemo } from "react";
import { useApp } from "../../../context/AppContext.jsx";

export default function Notifications() {
  const { notifications, markAllNotificationsRead } = useApp();

  const grouped = useMemo(() => {
    const groups = {};
    notifications.forEach((n) => {
      groups[n.group] = groups[n.group] || [];
      groups[n.group].push(n);
    });
    return groups;
  }, [notifications]);

  return (
    <div className="wrap" style={{ maxWidth: 720 }}>
      <div className="vhead headrow">
        <div>
          <span className="eyebrow">Notifications</span>
          <h2>Stay updated</h2>
          <p>Trace status updates, comments &amp; feedback, and new Tides content.</p>
        </div>
        <button className="btn ghost sm" onClick={markAllNotificationsRead}>Mark all read</button>
      </div>

      {Object.keys(grouped).map((group) => (
        <div className="ngroup" key={group}>
          <h4>{group}</h4>
          {grouped[group].map((n) => (
            <div className="nitem" key={n.id} role="button" tabIndex={0}>
              <div className="nico" style={{ background: n.unread ? "#e2f2f2" : "var(--bg)" }}>🔔</div>
              <div className="tx">
                {n.text}
                <div className="tm">{n.when}</div>
              </div>
              {n.unread && <span className="udot" />}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
