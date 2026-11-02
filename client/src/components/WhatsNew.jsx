import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import useRemoteData from "../hooks/useRemoteData.js";
import AdminIcon from "./AdminIcon.jsx";
import RelativeTime from "./RelativeTime.jsx";

const SHOWN = 3;

// The latest unread notifications, so a member sees what changed since their last visit.
// Nothing renders when everything is read, or when the notifications cannot be loaded.
export default function WhatsNew() {
  const { unreadNotificationCount } = useApp();
  // The app drops the count to null while it refreshes (for example when the tab regains focus).
  // Keep the last known number so the block stays put instead of disappearing and returning.
  const known = useRef(0);
  if (Number.isInteger(unreadNotificationCount)) known.current = unreadNotificationCount;
  const unread = known.current;
  const result = useRemoteData(unread > 0 ? "notifications?limit=10&offset=0" : null, { collection: true, keepPrevious: true });
  // Fetch again only when the unread count really changes, and keep showing the old list meanwhile.
  const seen = useRef(unread);
  useEffect(() => {
    if (unread === seen.current) return;
    seen.current = unread;
    if (unread > 0) result.retry();
  }, [unread, result.retry]);
  const items = (result.data || []).filter((row) => !row.read_at).slice(0, SHOWN);
  if (!unread) return null;
  // Hold the space with placeholder rows while the list loads, so the page does not jump.
  if (result.loading) return <section aria-label="What's new" aria-busy="true">
    <div className="dash-head"><h2 className="sec-t">What's new</h2></div>
    <div className="news-list" aria-hidden="true">
      {Array.from({ length: Math.min(unread, SHOWN) }, (_, index) => <span key={index} className="news-item news-skeleton"><span className="sk" /></span>)}
    </div>
  </section>;
  if (!items.length) return null;
  return <section aria-labelledby="whats-new-title">
    <div className="dash-head">
      <h2 className="sec-t" id="whats-new-title">What's new</h2>
      <Link className="sec-link" to="/user/notifications">{unread > items.length ? `All ${unread} unread` : "All notifications"}</Link>
    </div>
    <div className="news-list">
      {items.map((row) => <Link key={row.id} className="news-item" to="/user/notifications">
        <span className="news-icon" aria-hidden="true"><AdminIcon name="bell" /></span>
        <span className="news-text">
          <span className="news-message">{row.message}</span>
          <span className="m"><RelativeTime value={row.created_at} /></span>
        </span>
      </Link>)}
    </div>
  </section>;
}
