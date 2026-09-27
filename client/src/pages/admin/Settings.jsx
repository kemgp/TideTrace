import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import AdminIcon from "../../components/AdminIcon.jsx";
import { CategoryEditor } from "./ManageCategories.jsx";
import useRemoteData from "../../hooks/useRemoteData.js";
import RemoteState, { Pagination } from "../../components/RemoteState.jsx";

const tabs = [["moderation", "Moderation", "shield"], ["content", "Content", "book"], ["permissions", "User permissions", "key"], ["app", "App configuration", "settings"], ["categories", "Trace categories", "tag"], ["logs", "System logs", "log"]];
function Setting({ title, description, children }) {
  return <div className="setrow admin-setting-row"><div className="admin-setting-copy"><div className="l">{title}</div><div className="s">{description}</div></div>{children}</div>;
}
function Switch({ label, value, onChange }) {
  return <button type="button" className={`tgl ${value ? "" : "off"}`} role="switch" aria-label={label} aria-checked={value} onClick={() => onChange(!value)} />;
}
function AuditLogs() {
  const [offset, setOffset] = useState(0);
  const result = useRemoteData(`admin/audit-logs?limit=25&offset=${offset}`, { collection: true });
  const rows = result.data || [];
  return <div className="card"><h3>System logs</h3><RemoteState {...result} />{!result.loading && !result.error && (!rows.length ? <p className="hint">No system logs on this page.</p> : rows.map((row) => <div className="lrow" key={row.id}><time className="hint">{new Date(row.created_at).toLocaleString()}</time><div className="grow"><div className="t">{(row.action || "Account updated").replaceAll("_", " ")}</div>{row.reason && <p className="hint">{row.reason}</p>}</div></div>))}<Pagination offset={offset} count={rows.length} size={25} onChange={setOffset} loading={result.loading || Boolean(result.error)} /></div>;
}
export default function Settings() {
  const [params, setParams] = useSearchParams();
  const tab = tabs.some(([id]) => id === params.get("tab")) ? params.get("tab") : "moderation";
  const [values, setValues] = useState({ review: true, flag: true, draft: true, voice: true, maintenance: false, impact: true, revisions: "3", media: "5", name: "TideTrace", email: "support@tidetrace.app" });
  const [notice, setNotice] = useState("");
  const change = (key, value) => { setValues((old) => ({ ...old, [key]: value })); setNotice(""); };
  const toggle = (key, label) => <Switch label={label} value={values[key]} onChange={(value) => change(key, value)} />;
  const settings = {
    moderation: [["review", "Require review for all traces", "Review submissions before publishing"], ["flag", "Auto-flag keywords", "Flag comments containing reported keywords"]],
    content: [["draft", "Default new Tides to draft", "Lessons need explicit publishing"], ["voice", "Allow voice-story traces", "Users can record oral histories"]],
    app: [["maintenance", "Maintenance mode", "Temporarily disable new submissions"], ["impact", "Public impact page", "Show community stats on the homepage"]],
  };
  return <div className="wrap">
    <div className="vhead"><span className="eyebrow claye">System settings</span><h2>Platform configuration</h2></div>
    <div className="admin-settings-grid"><nav className="admin-settings-nav" aria-label="System settings sections">{tabs.map(([id, label, icon]) => <button key={id} className={`settings-menu ${tab === id ? "active" : ""}`} aria-current={tab === id ? "page" : undefined} onClick={() => { setParams({ tab: id }); setNotice(""); }}><span><AdminIcon name={icon} size={17} /></span>{label}</button>)}</nav>
      <div className="admin-settings-body">
        {tab === "categories" ? <CategoryEditor /> : tab === "logs" ? <AuditLogs /> : tab === "permissions" ? <div className="card admin-permissions"><div className="table-scroll" role="region" aria-label="Role access overview" tabIndex={0}><table><caption>Role access overview</caption><thead><tr><th>Permission</th><th>User</th><th>Mod</th><th>Admin</th></tr></thead><tbody>{["Review traces", "Manage comments", "Manage reports", "Manage users", "Manage Tides content", "System logs"].map((permission, index) => <tr key={permission}><th scope="row">{permission}</th><td>—</td><td>{index < 3 ? "✓" : "—"}</td><td>✓</td></tr>)}</tbody></table></div><p className="hint admin-note">Role permissions are enforced by the server. This table does not change account access.</p></div> : <form className="card" onSubmit={(event) => { event.preventDefault(); setNotice("Preview updated. These settings are not connected to the platform and reset when you leave this page."); }}>
          <p className="hint admin-preview-note">Design preview — these controls do not change live platform settings.</p>
          {tab === "app" && <div className="g2"><label className="fgroup">Platform name<input className="input" required value={values.name} onChange={(e) => change("name", e.target.value)} /></label><label className="fgroup">Support email<input type="email" className="input" required value={values.email} onChange={(e) => change("email", e.target.value)} /></label></div>}
          {settings[tab].map(([key, title, description]) => <Setting key={key} title={title} description={description}>{toggle(key, title)}</Setting>)}
          {(tab === "moderation" || tab === "content") && <Setting title={tab === "moderation" ? "Max revisions per trace" : "Max media per trace"} description={tab === "moderation" ? "Before auto-reject" : "Photos and videos combined"}><select className="input admin-small-select" aria-label={tab === "moderation" ? "Max revisions per trace" : "Max media per trace"} value={values[tab === "moderation" ? "revisions" : "media"]} onChange={(e) => change(tab === "moderation" ? "revisions" : "media", e.target.value)}>{[1, 2, 3, 4, 5, 10].map((number) => <option key={number}>{number}</option>)}</select></Setting>}
          <button className="btn blue sm" type="submit">Apply preview</button>{notice && <p className="hint admin-note" role="status">{notice}</p>}
        </form>}
      </div>
    </div>
  </div>;
}
