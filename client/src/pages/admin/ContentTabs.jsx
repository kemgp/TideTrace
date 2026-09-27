import React from "react";
import { NavLink } from "react-router-dom";
export default function ContentTabs() {
  return <nav className="chiprow admin-content-tabs" aria-label="Content sections">
    <NavLink end to="/admin/tides" className={({ isActive }) => `chip ${isActive ? "on" : ""}`}>Topics / Lessons</NavLink>
    <NavLink to="/admin/categories" className={({ isActive }) => `chip ${isActive ? "on" : ""}`}>Trace Categories</NavLink>
  </nav>;
}
