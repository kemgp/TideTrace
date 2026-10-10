import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AdminIcon from "../../components/AdminIcon.jsx";
import { CategoryEditor } from "./ManageCategories.jsx";
import useRemoteData from "../../hooks/useRemoteData.js";
import RemoteState, { Pagination } from "../../components/RemoteState.jsx";

import { useApp } from "../../context/AppContext.jsx";
import "./Settings.css";

const tabs = [["moderation", "Moderation", "shield"], ["content", "Content", "book"], ["permissions", "User permissions", "key"], ["app", "App configuration", "settings"], ["categories", "Trace categories", "tag"], ["logs", "System logs", "log"]];
function Setting({ title, description, children }) {
  return <div className="setrow admin-setting-row"><div className="admin-setting-copy"><div className="l">{title}</div><div className="s">{description}</div></div>{children}</div>;
}
function Switch({ label, value, onChange }) {
  return <button type="button" className={`tgl ${value ? "" : "off"}`} role="switch" aria-label={label} aria-checked={value} onClick={() => onChange(!value)} />;
}
function RulesPanel({ title, description, rules, to, action, note }) {
  return <section className="card admin-settings-panel">
    <header className="admin-settings-panel__header"><h3>{title}</h3><p>{description}</p></header>
    <dl className="admin-settings-rules">{rules.map(([label, detail]) => <div key={label}><dt>{label}</dt><dd>{detail}</dd></div>)}</dl>
    {note && <p className="admin-settings-note">{note}</p>}
    <div className="admin-settings-actions"><Link className="btn outline sm" to={to}>{action}</Link></div>
  </section>;
}
function AuditLogs() {
  const [offset, setOffset] = useState(0);
  const result = useRemoteData(`admin/audit-logs?limit=25&offset=${offset}`, { collection: true });
  const rows = result.data || [];
  return <section className="card admin-settings-panel admin-settings-logs">
    <header className="admin-settings-panel__header"><h3>System logs</h3><p>Account and platform changes are listed here. Trace and report decisions, including who reviewed them, are in moderation history.</p><Link className="btn outline sm" to="/admin/review/history">View moderation decisions</Link></header>
    <RemoteState compact {...result} />
    {!result.loading && !result.error && (!rows.length ? <p className="admin-settings-empty">No system logs on this page.</p> : <div className="admin-settings-log-list">{rows.map((row) => <article className="admin-settings-log" key={row.id}><div><h4>{(row.action || "Account updated").replaceAll("_", " ")}</h4><p className="hint">Changed by {row.actor?.display_name || "Admin"}</p></div><time className="hint" dateTime={row.created_at}>{new Date(row.created_at).toLocaleString()}</time>{row.reason && <p className="admin-settings-log__reason">{row.reason}</p>}</article>)}</div>)}
    <Pagination offset={offset} count={rows.length} size={25} onChange={setOffset} loading={result.loading || Boolean(result.error)} />
  </section>;
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
  return <form className="card admin-settings-panel" onSubmit={save}>
    <header className="admin-settings-panel__header"><h3>Submission and upload settings</h3><p>Control new Trace submissions and the number of attachments allowed per Trace.</p></header>
    <fieldset disabled={busy || blocked} style={{ border: 0, padding: 0 }}>
      <Setting title="Pause Trace submissions" description="Blocks new submissions and resubmissions for everyone. Draft saving, reading and moderator reviews remain available.">
        <Switch label="Pause Trace submissions" value={value.submissions_paused} onChange={next => setValue(old => ({ ...old, submissions_paused: next }))} />
      </Setting>
      <Setting title="Maximum media per Trace" description="Limits new attachments. Lowering this limit does not delete existing photos or videos.">
        <select className="input admin-small-select" aria-label="Maximum media per Trace" value={value.max_media_per_trace} onChange={event => setValue(old => ({ ...old, max_media_per_trace: Number(event.target.value) }))}>{Array.from({ length: 10 }, (_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}</select>
      </Setting>
    </fieldset>
    <div className="admin-settings-actions">
      <fieldset disabled={busy || blocked}><button className="btn blue sm" type="submit">{busy ? "Saving…" : "Save settings"}</button></fieldset>
      <button className="btn outline sm" type="button" disabled={busy} onClick={reload}>Reload saved settings</button>
    </div>
    {notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
  </form>;
}
export default function Settings() {
  const [params, setParams] = useSearchParams();
  const tab = tabs.some(([id]) => id === params.get("tab")) ? params.get("tab") : "moderation";
  return <div className="wrap">
    <div className="vhead"><span className="eyebrow claye">System settings</span><h2>Platform configuration</h2><p>Manage platform rules, account permissions, and submission settings.</p></div>
    <div className="admin-settings-grid"><nav className="admin-settings-nav" aria-label="System settings sections">{tabs.map(([id,label,icon]) => <button key={id} className={`settings-menu ${tab===id ? "active" : ""}`} aria-current={tab===id ? "page" : undefined} onClick={() => setParams({tab:id})}><span><AdminIcon name={icon} size={17}/></span>{label}</button>)}</nav>
      <div className="admin-settings-body">
        {tab === "categories" ? <CategoryEditor/> : tab === "logs" ? <AuditLogs/> : tab === "app" ? <WorkflowSettings/> : tab === "permissions" ?
          <RulesPanel title="Role permissions" description="Access and responsibilities for each account role." rules={[
            ["Members", "Submit Traces, comment, report content and complete Tides."],
            ["Moderators", "Review Traces and reports."],
            ["Admins", "Also manage accounts, categories, lessons and settings."],
          ]} note="Admin roles cannot be assigned through account management." to="/admin/users" action="Manage accounts"/> : tab === "moderation" ?
          <RulesPanel title="Moderation rules" description="The review requirements applied to every Trace submission." rules={[
            ["Staff review", "All submitted Traces require staff review. Authors cannot review their own submissions."],
            ["Review feedback", "Rejections and revision requests require feedback."],
            ["Manual decisions", "There is no automatic keyword flagging or automatic rejection after a fixed number of revisions."],
          ]} to="/admin/review" action="Review submissions"/> :
          <RulesPanel title="Content rules" description="Publishing and upload requirements for lessons and Traces." rules={[
            ["Lesson publishing", "New lessons start as drafts in the editor and require an explicit publish action."],
            ["Trace submissions", "Trace submissions require a photo and an active category."],
            ["Supported uploads", "Uploads support JPEG, PNG, WebP and MP4. Voice recording is not available."],
          ]} to="/admin/tides" action="Manage lessons"/>}
      </div>
    </div>
  </div>;
}
