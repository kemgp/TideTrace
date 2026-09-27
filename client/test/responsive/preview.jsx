// Development-only viewport harness. All API requests use local fixtures.
// It does not read or write a real account session or contact the backend.
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import App from "../../src/App.jsx";
import { SESSION_KEY } from "../../src/api/session.js";
import "../../src/index.css";
import "../../src/responsive.css";

const widths = [320, 375, 768, 1024, 1440];
const routes = [
  ["guest", "/"], ["guest", "/login"], ["guest", "/register"], ["guest", "/forgot-password"], ["guest", "/auth/callback"],
  ...["/user/dashboard", "/user/traces", "/user/traces/trace-1", "/user/traces/upload", "/user/contributions", "/user/contributions/trace-1", "/user/contributions/trace-1/edit", "/user/tides", "/user/tides/lesson-1", "/user/notifications", "/user/profile"].map((path) => ["user", path]),
  ...["/moderator/dashboard", "/moderator/review", "/moderator/review/trace-1", "/moderator/review/history", "/moderator/comments", "/moderator/reports", "/moderator/analytics", "/moderator/profile"].map((path) => ["moderator", path]),
  ...["/admin/dashboard", "/admin/users", "/admin/moderators", "/admin/moderators?add=1", "/admin/tides", "/admin/tides/new", "/admin/tides/lesson-1/edit", "/admin/categories", "/admin/review", "/admin/review/trace-1", "/admin/review/history", "/admin/reports", "/admin/settings", "/admin/settings?tab=app", "/admin/settings?tab=permissions", "/admin/settings?tab=logs", "/admin/analytics", "/admin/profile"].map((path) => ["admin", path]),
];
routes.push(
  ["admin", "/admin/users", "View / Edit"],
  ...["Basic information", "Security", "Recent activity", "Quick actions"].map((action) => ["admin", "/admin/profile", action]),
  ...["Basic information", "Security", "Preferences"].map((action) => ["moderator", "/moderator/profile", action]),
  ...["Privacy", "App settings", "Security", "Usage & activity"].map((action) => ["user", "/user/profile", action]),
);
const params = new URLSearchParams(location.search);
const frameMode = params.get("frame") === "1";
if (frameMode) {
  const role = params.get("role");
  const path = params.get("path");
  const storage = new Map();
  Object.defineProperty(window, "sessionStorage", { configurable: true, value: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key), clear: () => storage.clear() } });
  if (role !== "guest") sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "fixture", refresh_token: "fixture", expires_at: Date.now() / 1000 + 3600 }));
  const profile = { id: "fixture-owner", display_name: "Alexandra Community Reviewer", email: "alexandra.long.name@example.test", status: "active", role };
  const category = { id: "category-1", name: "Coral condition", slug: "coral-condition" };
  const trace = { id: "trace-1", title: "Community coastal observation with a long descriptive title", category, category_id: category.id, author: profile, author_id: path.includes("contributions") ? profile.id : "other-member", location_name: "Barangay coastal observation and conservation area", description: "A detailed community observation. ".repeat(12), status: path.includes("contributions") ? "draft" : path.includes("review") ? "pending" : "approved", version: 3, created_at: "2026-09-27T10:00:00Z", published_at: "2026-09-27T10:00:00Z", updated_at: "2026-09-27T10:00:00Z", trace_media: [{ id: "photo-1", sort_order: 0, mime_type: "image/svg+xml", alt_text: "Local responsive test image" }] };
  const lesson = { id: "lesson-1", title: "Understanding coastal ecosystems and community conservation", slug: "coastal-ecosystems", body: "Learning content and conservation guidance. ".repeat(30), status: "published", updated_at: "2026-09-27T10:00:00Z" };
  const report = { id: "report-1", trace_id: trace.id, trace, reporter: profile, reason: "Location information should be reviewed by the moderation team.", status: "open", created_at: trace.created_at };
  window.fetch = async (input) => {
    const url = new URL(typeof input === "string" ? input : input.url, location.origin);
    const route = url.pathname.replace(/^\/api\//, "");
    let data = [];
    if (route === "auth/me") data = profile;
    else if (route === "categories" || route === "admin/categories") data = [category];
    else if (route === "notifications/unread-count") data = { count: 1 };
    else if (route === "notifications") data = [{ id: "notification-1", message: "Your observation has been reviewed. ".repeat(8), created_at: trace.created_at, read_at: null }];
    else if (route.endsWith("/url")) data = { url: `${location.origin}/test/responsive/photo.svg` };
    else if (route.includes("reports/")) data = report;
    else if (route.endsWith("reports")) data = [report];
    else if (route === "moderation/history") data = [{ id: "decision-1", action: "review_trace", trace, trace_id: trace.id, to_state: "approved", reason: "Evidence reviewed and approved.", actor: profile, created_at: trace.created_at }];
    else if (route === "admin/audit-logs") data = [{ id: "log-1", action: "set_account", reason: "Account details reviewed.", created_at: trace.created_at }];
    else if (route.endsWith("/reviews") || route.endsWith("/comments") || route.includes("tide-completions")) data = [];
    else if (route.includes("tides/")) data = lesson;
    else if (route.endsWith("tides")) data = [lesson, { ...lesson, id: "lesson-2" }, { ...lesson, id: "lesson-3" }];
    else if (route.includes("traces/") || route.includes("contributions/")) data = trace;
    else if (route.endsWith("traces") || route === "contributions") data = [trace, { ...trace, id: "trace-2" }];
    return new Response(JSON.stringify({ data }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  createRoot(document.getElementById("root")).render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
  let actionFound = true;
  const measure = () => {
    const width = document.documentElement.clientWidth;
    const overflow = document.documentElement.scrollWidth > width + 1;
    const offenders = [...document.querySelectorAll(".app-shell *")].filter((element) => {
      if (!element.getClientRects().length || element.closest(".table-scroll")) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && (rect.right > width + 1 || rect.left < -1);
    }).slice(0, 8).map((element) => `${element.tagName.toLowerCase()}.${String(element.className).replaceAll(" ", ".")}`);
    return { overflow, actionFound, rendered: Boolean(document.querySelector(".app-shell main")), width, scrollWidth: document.documentElement.scrollWidth, offenders };
  };
  window.addEventListener("load", async () => {
    await document.fonts.ready;
    // Allow session restoration and fixture-backed reads to finish.
    setTimeout(() => {
      const action = params.get("action");
      if (action) {
        const button = [...document.querySelectorAll("button")].find((button) => button.textContent.includes(action));
        actionFound = Boolean(button);
        button?.click();
      }
      setTimeout(() => {
      const states = [{ state: "page", ...measure() }];
      if (innerWidth < 1280) {
        document.querySelector(".menu-btn")?.click();
        setTimeout(() => { states.push({ state: "menu open", ...measure() }); parent.postMessage({ type: "responsive-result", id: params.get("id"), path, role, states }, location.origin); }, 100);
      } else parent.postMessage({ type: "responsive-result", id: params.get("id"), path, role, states }, location.origin);
      }, 100);
    }, 300);
  });
} else {
  document.body.style.cssText = "padding:24px;font-family:system-ui;background:#edf7ff;color:#203463";
  document.getElementById("root").innerHTML = `<h1>Responsive viewport checks</h1><p>Local fixtures only. Checks all listed routes for page overflow with navigation closed and open. Manually inspect the displayed page for clipping and visual quality.</p><button id="run" style="padding:12px;margin:16px 0">Run all five widths</button><p id="progress" role="status">Ready</p><pre id="results" style="white-space:pre-wrap"></pre><div style="overflow:auto;max-width:100%"><iframe id="viewport" title="Responsive preview" style="display:block;border:1px solid #c7dcee;box-sizing:content-box;height:1000px;background:white"></iframe></div>`;
  let index = 0;
  const jobs = widths.flatMap((width) => routes.map(([role, path, action = ""]) => ({ width, role, path, action })));
  const results = [];
  const iframe = document.getElementById("viewport");
  const next = () => {
    if (index >= jobs.length) {
      document.getElementById("progress").textContent = `Completed ${results.length} route/viewport checks. ${results.filter((result) => result.states.some((state) => !state.rendered || !state.actionFound || state.overflow || state.offenders.length)).length} need review.`;
      document.getElementById("run").disabled = false;
      window.responsiveResults = results;
      return;
    }
    const job = jobs[index];
    iframe.style.width = `${job.width}px`;
    document.getElementById("progress").textContent = `${index + 1}/${jobs.length}: ${job.width}px · ${job.path}`;
    iframe.src = `/test/responsive/index.html?${new URLSearchParams({ frame: "1", id: String(index), role: job.role, path: job.path, action: job.action })}`;
  };
  document.getElementById("run").onclick = () => { index = 0; results.length = 0; document.getElementById("results").textContent = ""; document.getElementById("run").disabled = true; next(); };
  window.addEventListener("message", (event) => {
    if (event.origin !== location.origin || event.source !== iframe.contentWindow || event.data?.type !== "responsive-result" || event.data.id !== String(index)) return;
    results.push(event.data);
    const failed = event.data.states.some((state) => !state.rendered || !state.actionFound || state.overflow || state.offenders.length);
    document.getElementById("results").textContent += `${failed ? "REVIEW" : "PASS"} ${jobs[index].width}px ${event.data.path}${failed ? ` ${JSON.stringify(event.data.states)}` : ""}\n`;
    index += 1; next();
  });
}
