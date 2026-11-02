import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import useRemoteData from "../hooks/useRemoteData.js";
import AdminIcon from "./AdminIcon.jsx";
import RelativeTime from "./RelativeTime.jsx";
import "./NotificationMenu.css";

// The bell in the navbar: shows the unread count and opens a short list of the latest notifications,
// with a link to the full page. The list is fetched when the menu is first opened, then refreshed on each opening.
export default function NotificationMenu({ onNavigate }) {
  const { unreadNotificationCount, markNotificationsRead } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  // The app drops the count to null while it refreshes; keep the last number so the badge stays steady.
  const known = useRef(0);
  if (Number.isInteger(unreadNotificationCount)) known.current = unreadNotificationCount;
  const unread = known.current;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("all");
  const [fetched, setFetched] = useState(false);
  const root = useRef(null);
  const toggle = useRef(null);
  const result = useRemoteData(fetched ? "notifications?limit=10&offset=0" : null, { collection: true, keepPrevious: true });
  const seen = useRef(unread);
  useEffect(() => {
    if (unread === seen.current) return;
    seen.current = unread;
    if (open && fetched) result.retry();
  }, [unread, open, fetched, result.retry]);
  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const outside = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
    const escape = (event) => { if (event.key === "Escape") { setOpen(false); toggle.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  const flip = () => {
    if (!open) { if (fetched) result.retry(); else setFetched(true); }
    setOpen((value) => !value);
  };
  const rows = result.data || [];
  const shown = tab === "unread" ? rows.filter((row) => !row.read_at) : rows;
  const openRow = (row) => {
    setOpen(false);
    onNavigate?.();
    navigate("/user/notifications");
    if (!row.read_at) markNotificationsRead([row.id]);
  };
  const markAll = async () => { await markNotificationsRead(null); result.retry(); };
  return <div className="notif-menu" ref={root}>
    <button ref={toggle} type="button" className="nav-bell" aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
      aria-haspopup="true" aria-expanded={open} aria-controls="notification-panel" onClick={flip}>
      <AdminIcon name="bell" size={18} />
      {unread > 0 && <span className="nav-bell__badge" aria-hidden="true">{unread > 99 ? "99+" : unread}</span>}
    </button>
    {open && <section id="notification-panel" className="notif-panel" aria-label="Notifications panel">
      <div className="notif-head">
        <h2>Notifications</h2>
        {unread > 0 && <button type="button" className="notif-link" onClick={markAll}>Mark all as read</button>}
      </div>
      <div className="notif-tabs" role="group" aria-label="Show notifications">
        <button type="button" className="notif-tab" aria-pressed={tab === "all"} onClick={() => setTab("all")}>All</button>
        <button type="button" className="notif-tab" aria-pressed={tab === "unread"} onClick={() => setTab("unread")}>Unread</button>
      </div>
      <div className="notif-body">
        {result.loading && <p className="notif-empty" role="status">Loading…</p>}
        {result.error && <div className="notif-empty"><p role="alert">{result.error}</p><button type="button" className="notif-link" onClick={result.retry}>Try again</button></div>}
        {!result.loading && !result.error && !shown.length && <p className="notif-empty">{tab === "unread" ? "No unread notifications." : "You're all caught up."}</p>}
        {!result.loading && !result.error && shown.length > 0 && <ul className="notif-list">
          {shown.map((row) => <li key={row.id}>
            <button type="button" className={`notif-item${row.read_at ? "" : " is-unread"}`} onClick={() => openRow(row)}>
              <span className="notif-icon" aria-hidden="true"><AdminIcon name="bell" size={16} /></span>
              <span className="notif-text">
                <span className="notif-message">{row.message}</span>
                <span className="notif-time"><RelativeTime value={row.created_at} /></span>
              </span>
              {!row.read_at && <span className="notif-dot" role="img" aria-label="Unread" />}
            </button>
          </li>)}
        </ul>}
      </div>
      <Link className="notif-foot" to="/user/notifications" onClick={() => { setOpen(false); onNavigate?.(); }}>See all notifications</Link>
    </section>}
  </div>;
}
