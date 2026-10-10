import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export const SITE_URL = "https://tide-trace.vercel.app";
export const SITE_TITLE = "TideTrace — Every ripple counts";
export const SITE_DESCRIPTION = "Share coastal observations, learn about the sea, and connect with your community through TideTrace.";
const pages = {
 "/": [SITE_TITLE, SITE_DESCRIPTION],
 "/login": ["Sign in", "Sign in to your TideTrace account."],
 "/register": ["Create account", "Join TideTrace to share coastal observations and learn with your community."],
 "/forgot-password": ["Reset password", "Recover access to your TideTrace account."],
 "/auth/callback": ["Verify account", "Complete your TideTrace account verification."],
 "/user": ["Dashboard", "Your TideTrace activity and contributions."],
 "/user/dashboard": ["Dashboard", "Your TideTrace activity and contributions."],
 "/user/traces": ["Community Traces", "Explore coastal observations shared by the TideTrace community."],
 "/user/traces/upload": ["Upload Trace", "Save a coastal observation or submit it for review."],
 "/user/contributions": ["My Contributions", "Manage your saved Traces and review feedback."],
 "/user/tides": ["Tides", "Explore lessons about coastal communities and the sea."],
 "/user/notifications": ["Notifications", "Read updates about your Traces and reports."],
 "/user/profile": ["Account settings", "Manage your TideTrace account and preferences."],
};
const staffPages = { dashboard:"Dashboard", review:"Review Traces", "review/history":"Moderation history", analytics:"Analytics", comments:"Manage comments", reports:"Manage reports", profile:"Account settings", users:"Manage users", moderators:"Manage moderators", tides:"Manage Tides", "tides/new":"Create Tide", categories:"Trace categories", settings:"Platform settings" };
export function metadataForPath(pathname) {
 const path = pathname.replace(/\/+$/, "") || "/";
 if (pages[path]) return { title: path === "/" ? pages[path][0] : `${pages[path][0]} | TideTrace`, description: pages[path][1], indexable: path === "/" };
 const staff = path.match(/^\/(admin|moderator)\/(.+)$/);
 let title;
 if (staff) title = `${staffPages[staff[2]] || (/^tides\/[^/]+\/edit$/.test(staff[2]) ? "Edit Tide" : /^review\/[^/]+$/.test(staff[2]) ? "Review Trace" : "Workspace")} · ${staff[1] === "admin" ? "Admin" : "Moderator"}`;
 else if (/^\/user\/contributions\/[^/]+\/edit$/.test(path)) title = "Edit Trace";
 else if (/^\/user\/contributions\/[^/]+$/.test(path)) title = "My Trace";
 else if (/^\/user\/traces\/[^/]+$/.test(path)) title = "Trace details";
 else if (/^\/user\/tides\/[^/]+$/.test(path)) title = "Tide lesson";
 return { title: title ? `${title} | TideTrace` : "Page not found | TideTrace", description: "Sign in to TideTrace to access your coastal community.", indexable: false };
}
function setMeta(name, content) {
 let element = document.head.querySelector(`meta[name="${name}"]`);
 if (!element) { element = document.createElement("meta"); element.name = name; document.head.append(element); }
 element.content = content;
}
export default function PageMetadata() {
 const { pathname } = useLocation();
 useEffect(() => {
  const metadata = metadataForPath(pathname);
  document.title = metadata.title;
  setMeta("description", metadata.description);
  setMeta("robots", metadata.indexable ? "index, follow" : "noindex, nofollow");
  // Only the public homepage has a canonical URL. Never copy query/hash tokens.
  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!metadata.indexable) canonical?.remove();
  else {
   if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.append(canonical); }
   canonical.href = `${SITE_URL}/`;
  }
 }, [pathname]);
 return null;
}
