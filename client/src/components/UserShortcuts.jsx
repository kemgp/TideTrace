import React from "react";
import { Link } from "react-router-dom";
import AdminIcon from "./AdminIcon.jsx";
import "./UserShortcuts.css";

const SHORTCUTS = [
  { to: "/user/traces", icon: "pin", label: "Traces — explore the community archive" },
  { to: "/user/tides", icon: "book", label: "Tides — educational content" },
  { to: "/user/contributions", icon: "log", label: "My Contributions — track your traces" },
  { to: "/user/notifications", icon: "bell", label: "Notifications" },
  { to: "/user/profile", icon: "settings", label: "Settings" },
];

export default function UserShortcuts() {
  return <nav className="user-shortcuts" aria-labelledby="user-shortcuts-heading">
    <h3 className="sec-t" id="user-shortcuts-heading">Go to</h3>
    <ul className="user-shortcuts__list">
      {SHORTCUTS.map(({ to, icon, label }) => <li key={to}>
        <Link className="user-shortcuts__link" to={to}>
          <AdminIcon name={icon} size={20} />
          <span className="user-shortcuts__label">{label}</span>
          <span className="user-shortcuts__arrow" aria-hidden="true">›</span>
        </Link>
      </li>)}
    </ul>
  </nav>;
}
