// The last role seen in this browser. While a saved session is being restored the real role is
// unknown, and layout depends on it (the logged-in pages use a wider container and a different
// set of navigation links). The hint lets the placeholder use the same layout, so nothing moves
// when the account arrives. It is never used for access decisions, so a stale value is harmless. It lives in sessionStorage
// on purpose: the app keeps the role out of persistent storage (see the legacy cleanup in
// session.js), so the hint is per-tab and gone when the tab closes.
const KEY = "tidetrace-nav-role";
const ROLES = ["user", "mod", "admin"];

export function readRoleHint() {
  try {
    const value = window.sessionStorage.getItem(KEY);
    return ROLES.includes(value) ? value : "user";
  } catch { return "user"; }
}

export function writeRoleHint(role) {
  if (!ROLES.includes(role)) return;
  try { window.sessionStorage.setItem(KEY, role); } catch { /* Optional hint only. */ }
}
