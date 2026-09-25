import React from "react";
import { useApp } from "../../../context/AppContext.jsx";
import RemoteState, { Pagination } from "../../../components/RemoteState.jsx";

export default function Notifications() {
  const { notifications, unreadNotificationCount, notificationsLoading, notificationsError,
    notificationAction, notificationsOffset, setNotificationsOffset, refreshNotifications, markNotificationsRead } = useApp();
  const busy = notificationsLoading || notificationAction?.busy;
  return (
    <div className="wrap" style={{ maxWidth: 720 }}>
      <div className="vhead headrow">
        <div>
          <span className="eyebrow">Notifications</span>
          <h2>Stay updated</h2>
          <p>Review decisions and feedback on your Traces and reports.</p>
        </div>
        <div className="row">
          <button className="btn ghost sm" disabled={busy} onClick={refreshNotifications}>Refresh</button>
          <button className="btn ghost sm" disabled={busy || !unreadNotificationCount} onClick={() => markNotificationsRead(null)}>Mark all read</button>
        </div>
      </div>
      <RemoteState loading={notificationsLoading} error={notificationsError} retry={refreshNotifications} />
      {notificationAction?.error && <p role="alert">{notificationAction.error}</p>}
      <span className="notification-announcement" role="status">{notificationAction?.message || ""}</span>
      {!notificationsLoading && !notificationsError && <>
        {!notifications.length && <p>{notificationsOffset ? "No more notifications." : "You're all caught up. No notifications yet."}</p>}
        {notifications.map(n => (
          <div className={`nitem notification-item${n.unread ? " is-unread" : ""}`} key={n.id}>
            <div className="nico" aria-hidden="true">🔔</div>
            <div className="tx">{n.text}<div className="tm"><time dateTime={n.created_at}>{n.when}</time></div></div>
            <button className="btn ghost sm notification-read-action" disabled={busy || !n.unread} aria-hidden={!n.unread} tabIndex={n.unread ? 0 : -1} onClick={() => markNotificationsRead([n.id])}>Mark as read</button>
          </div>
        ))}
      </>}
      <Pagination offset={notificationsOffset} count={notifications.length} size={25} onChange={setNotificationsOffset} loading={Boolean(busy)} />
    </div>
  );
}
