import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AdminIcon from "../../components/AdminIcon.jsx";
import { CategoryEditor } from "./ManageCategories.jsx";
import useRemoteData from "../../hooks/useRemoteData.js";
import RemoteState, { Pagination } from "../../components/RemoteState.jsx";

import { useApp } from "../../context/AppContext.jsx";

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
  return <div className="card"><h3>System logs</h3><p className="hint">Account and platform changes are listed here. Trace and report decisions, including who reviewed them, are in moderation history.</p><Link className="btn outline sm" to="/admin/review/history">View moderation decisions</Link><RemoteState compact {...result} />{!result.loading && !result.error && (!rows.length ? <p className="hint">No system logs on this page.</p> : rows.map((row) => <div className="lrow" key={row.id}><time className="hint">{new Date(row.created_at).toLocaleString()}</time><div className="grow"><div className="t">{(row.action || "Account updated").replaceAll("_", " ")}</div><p className="hint">Changed by {row.actor?.display_name || "Admin"}</p>{row.reason && <p className="hint">{row.reason}</p>}</div></div>))}<Pagination offset={offset} count={rows.length} size={25} onChange={setOffset} loading={result.loading || Boolean(result.error)} /></div>;
}
function WorkflowSettings() {
  const result = useRemoteData("admin/workflow-settings");
  return <><RemoteState {...result} />{result.data && <WorkflowForm key={`${result.data.updated_at}:${JSON.stringify(result.data.value)}`} saved={result.data} reload={result.retry} />}</>;
}
function WorkflowForm({ saved, reload }) {
  const { writeData } = useApp();
  const [value, setValue] = useState(saved.value);
  const [stamp, setStamp] = useState(saved.updated_at);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);
  async function save(event) {
    event.preventDefault(); if (request.current || blocked) return;
    const controller = new AbortController(); request.current = controller; setBusy(true); setError(""); setNotice("");
    try {
      const result = await writeData("admin/workflow-settings", { method: "PUT", body: { value, updated_at: stamp }, signal: controller.signal });
      if (controller.signal.aborted) return;
      if (result?.id !== "workflow" || result.value?.submissions_paused !== value.submissions_paused || result.value?.max_media_per_trace !== value.max_media_per_trace) throw new Error("Could not verify saved settings.");
      setStamp(result.updated_at); setNotice("Settings saved.");
    } catch (failure) {
      if (!controller.signal.aborted) { setError(`${failure.message} Reload saved settings before trying again.`); setBlocked(true); }
    } finally { request.current = null; if (!controller.signal.aborted) setBusy(false); }
  }
  return <form className="card" onSubmit={save}>
    <h3>Submission and upload settings</h3>
    <fieldset disabled={busy || blocked} style={{ border: 0, padding: 0 }}>
      <Setting title="Pause Trace submissions" description="Blocks new submissions and resubmissions for everyone. Draft saving, reading and moderator reviews remain available.">
        <Switch label="Pause Trace submissions" value={value.submissions_paused} onChange={next => setValue(old => ({ ...old, submissions_paused: next }))} />
      </Setting>
      <Setting title="Maximum media per Trace" description="Limits new attachments. Lowering this limit does not delete existing photos or videos.">
        <select className="input" aria-label="Maximum media per Trace" value={value.max_media_per_trace} onChange={event => setValue(old => ({ ...old, max_media_per_trace: Number(event.target.value) }))}>{Array.from({ length: 10 }, (_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}</select>
      </Setting>
      <button className="btn blue sm" type="submit">{busy ? "Saving…" : "Save settings"}</button>
    </fieldset>
    {notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
    <button className="btn outline sm" type="button" disabled={busy} onClick={reload}>Reload saved settings</button>
  </form>;
}
export default function Settings() {
  const [params, setParams] = useSearchParams();
  const tab = tabs.some(([id]) => id === params.get("tab")) ? params.get("tab") : "moderation";
  return <div className="wrap">
    <div className="vhead"><span className="eyebrow claye">System settings</span><h2>Platform configuration</h2></div>
    <div className="admin-settings-grid"><nav className="admin-settings-nav" aria-label="System settings sections">{tabs.map(([id,label,icon]) => <button key={id} className={`settings-menu ${tab===id ? "active" : ""}`} aria-current={tab===id ? "page" : undefined} onClick={() => setParams({tab:id})}><span><AdminIcon name={icon} size={17}/></span>{label}</button>)}</nav>
      <div className="admin-settings-body">
        {tab === "categories" ? <CategoryEditor/> : tab === "logs" ? <AuditLogs/> : tab === "app" ? <WorkflowSettings/> : tab === "permissions" ? <div className="card"><h3>Role permissions</h3><p>Members submit Traces, comment, report content and complete Tides. Moderators review Traces and reports. Admins also manage accounts, categories, lessons and settings.</p><p>Admin roles cannot be assigned through account management.</p><Link to="/admin/users">Manage accounts</Link></div> : tab === "moderation" ? <div className="card"><h3>Moderation rules</h3><p>All submitted Traces require staff review. Rejections and revision requests require feedback. Authors cannot review their own submissions.</p><p>There is no automatic keyword flagging or automatic rejection after a fixed number of revisions.</p><Link to="/admin/review">Review submissions</Link></div> : <div className="card"><h3>Content rules</h3><p>New lessons start as drafts in the editor and require an explicit publish action. Trace submissions require a photo and an active category.</p><p>Uploads support JPEG, PNG, WebP and MP4. Voice recording is not available.</p><Link to="/admin/tides">Manage lessons</Link></div>}
      </div>
    </div>
  </div>;
}
