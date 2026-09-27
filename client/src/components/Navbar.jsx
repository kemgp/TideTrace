import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";

import AdminIcon from "./AdminIcon.jsx";

const WAVE = (
  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
    <path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
    <path d="M2 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
  </svg>
);

const userLinks = [
  { to: "/user/dashboard", label: "Dashboard" },
  { to: "/user/traces", label: "Traces" },
  { to: "/user/tides", label: "Tides" },
  { to: "/user/contributions", label: "Contributions" },
  { to: "/user/notifications", label: "Notifications" },
  { to: "/user/profile", label: "Settings" },
];

const modLinks = [
  { to: "/moderator/dashboard", label: "Dashboard" },
  { to: "/moderator/review", label: "Review Traces" },
  { to: "/moderator/comments", label: "Comments" },
  { to: "/moderator/reports", label: "Reports" },
];

const adminLinks = [
  { to: "/admin/dashboard", label: "Dashboard", icon: "dashboard" },
  { to: "/admin/users", label: "Users", icon: "users" },
  { to: "/admin/moderators", label: "Moderators", icon: "shield" },
  { to: "/admin/tides", label: "Content", icon: "book" },
  { to: "/admin/review/history", label: "History", icon: "history" },
  { to: "/admin/settings", label: "Settings", icon: "settings" },
  { to: "/admin/analytics", label: "Analytics", icon: "chart" },
];

export default function Navbar() {
  const { role, profile, logout, unreadNotificationCount } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const links = role === "mod" ? modLinks : role === "admin" ? adminLinks : role === "user" ? userLinks : [];
  const unread = unreadNotificationCount;
  const isAuthPage = ["/login", "/register", "/forgot-password"].includes(location.pathname);
  const avatarClass = role === "mod" ? "avatar-btn mod" : role === "admin" ? "avatar-btn admin" : "avatar-btn";
  const avatarLetter = profile?.display_name?.trim().charAt(0).toUpperCase() || "?";
  const homeLink = role === "mod" ? "/moderator/dashboard" : role === "admin" ? "/admin/dashboard" : role === "user" ? "/user/dashboard" : "/";

  const isActive = (link) => {
    const path = location.pathname;
    if (path === link.to) return true;
    if (role !== "admin") return false;
    if (link.label === "Content") return path.startsWith("/admin/tides/") || path === "/admin/categories";
    if (link.label === "History") return path.startsWith("/admin/review") || path === "/admin/reports";
    return false;
  };

  return (
    <nav className={`nav ${open ? "open" : ""}`}>
      <div className="wrap nav-grid">
        <Link className="brand" to={homeLink} onClick={() => setOpen(false)}>
          {WAVE}
          <span>TideTrace</span>
        </Link>

        {role ? (
          <ul className="nav-links">
            {links.map((l) => (
              <li key={l.to}>
                <Link aria-label={l.label === "Notifications" && unread > 0 ? `Notifications (${unread} unread)` : undefined} aria-current={isActive(l) ? "page" : undefined} className={isActive(l) ? "on" : ""} to={l.to} onClick={() => setOpen(false)}>
                  {l.icon && <AdminIcon name={l.icon} size={16} />}
                  {l.label}
                  {l.label === "Notifications" && unread > 0 && <span className="nav-badge">{unread}</span>}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="nav-links">
            <li>{isAuthPage ? <Link to="/#home-mission">Our Mission</Link> : <a href="#home-mission">Our Mission</a>}</li>
            <li>{isAuthPage ? <Link to="/#home-features">Features</Link> : <a href="#home-features">Features</a>}</li>
            <li>{isAuthPage ? <Link to="/#home-impact">Impact</Link> : <a href="#home-impact">Impact</a>}</li>
            <li>{isAuthPage ? <Link to="/#home-how">How it Works</Link> : <a href="#home-how">How it Works</a>}</li>
          </ul>
        )}

        <div className="nav-right">
          {role ? (
            <>
              {role === "user" && (
                <button className="btn ghost sm nav-profile" onClick={() => navigate("/user/profile")}>
                  Change profile
                </button>
              )}
              {role !== "user" && (
                <span className="role-tag" style={{ background: role === "mod" ? "var(--teal)" : "var(--blue)" }}>
                  {role === "mod" ? "Moderator" : "Admin"}
                </span>
              )}
              <button type="button" className="btn ghost sm nav-logout" onClick={() => { setOpen(false); logout(); navigate("/login", { replace: true }); }}>
                Log out
              </button>
              <button
                className={avatarClass}
                  title="Profile Settings"
                    onClick={() => {
            if (role === "user") {
                navigate("/user/profile");
          } else if (role === "mod") {
                navigate("/moderator/profile");
          } else if (role === "admin") {
              navigate("/admin/profile");
      }
        }}
        >
            {avatarLetter}
              </button>
            </>
          ) : (
            <>
              <button className="btn ghost sm" onClick={() => navigate("/login")}>Log in</button>
              <button className="btn clay sm" onClick={() => navigate("/register")}>Join TideTrace</button>
            </>
          )}
          <button className="menu-btn" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#203463" strokeWidth={2}>
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
}
