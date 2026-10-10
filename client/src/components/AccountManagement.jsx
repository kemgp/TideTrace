import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import useRemoteData from "../hooks/useRemoteData.js";
import RemoteState, { Pagination } from "./RemoteState.jsx";
import "./AccountManagement.css";

export default function AccountManagement({ moderators = false }) {
  const { profile } = useApp();
  return <Accounts key={`${profile.id}:${moderators}`} moderators={moderators} />;
}
function Accounts({ moderators }) {
  const [params, setParams] = useSearchParams();
  const assigning = moderators && params.get("add") === "1";
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState("");
  const filterRole = moderators ? assigning ? "user" : "moderator" : role;
  const request = new URLSearchParams({ limit: "25", offset: String(offset) });
  if (filterRole) request.set("role", filterRole);
  if (status) request.set("status", status);
  if (query) request.set("q", query);
  const result = useRemoteData(`admin/users?${request}`, { collection: true });
  const rows = result.data || [];
  const reset = () => { setOffset(0); setSelected(null); setNotice(""); };
  return <div className="wrap">
    <div className="vhead"><span className="eyebrow claye">{moderators ? "Manage moderators" : "Manage users"}</span><h2>{moderators ? "Moderation team" : "Community accounts"}</h2>
      <p>{assigning ? "Choose an existing member to promote. New people must register first." : "Manage saved account roles and access. Every change requires a reason and is recorded."}</p>
    </div>
    {moderators && <><button className="btn blue sm" onClick={() => { reset(); setParams(assigning ? {} : { add: "1" }); }}>{assigning ? "Back to moderators" : "Add moderator"}</button><p className="hint">Moderators share the same review and report permissions. Removing the moderator role keeps the account and its contributions.</p></>}
    <form className="account-filters" onSubmit={(event) => { event.preventDefault(); reset(); setQuery(search.trim()); }}>
      <div className="account-filters__search">
        <label>Search by name or account ID<input className="input" value={search} maxLength={100} onChange={(event) => setSearch(event.target.value)} /></label>
        <button type="submit" className="btn outline sm">Search accounts</button>
      </div>
      {!moderators && <label>Role<select className="input" value={role} onChange={(event) => { reset(); setRole(event.target.value); }}><option value="">All roles</option><option value="user">Member</option><option value="moderator">Moderator</option><option value="admin">Admin</option></select></label>}
      <label>Account status<select className="input" value={status} onChange={(event) => { reset(); setStatus(event.target.value); }}><option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option></select></label>
      <button type="button" className="btn outline sm" disabled={result.loading} onClick={() => { setSelected(null); result.retry(); }}>Refresh accounts</button>
    </form>
    {notice && <p role="status">{notice}</p>}
    <RemoteState {...result} />
    {!result.loading && !result.error && (rows.length ? <div className="card account-list">{rows.map((account) => <div className="lrow" key={account.id}>
      <div className="grow"><div className="t">{account.display_name}</div><div className="m">{account.role === "user" ? "Member" : account.role} · {account.status}</div><small style={{ overflowWrap: "anywhere" }}>Account ID: {account.id}</small></div>
      <button className="mini blue" onClick={() => setSelected(account.id)}>{assigning ? "Assign moderator" : "Manage account"}</button>
    </div>)}</div> : <p>No accounts match these filters.</p>)}
    <Pagination offset={offset} count={rows.length} size={25} onChange={(value) => { setSelected(null); setOffset(value); }} loading={result.loading || Boolean(result.error)} />
    {selected && <AccountDetail key={selected} id={selected} promote={assigning} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); setNotice("Account changes saved."); result.retry(); }} />}
  </div>;
}
function AccountDetail({ id, promote, onClose, onSaved }) {
  const result = useRemoteData(`admin/users/${encodeURIComponent(id)}`);
  return <section className="card" aria-label="Manage selected account" style={{ marginTop: 20 }}>
    <RemoteState {...result} />
    {result.data && <AccountEditor key={result.data.updated_at} account={result.data} promote={promote} reload={result.retry} onSaved={onSaved} />}
    <button className="btn ghost sm" onClick={onClose}>Close account</button>
    <AccountAudit id={id} />
  </section>;
}
function AccountEditor({ account, promote, reload, onSaved }) {
  const { profile, writeData, readData } = useApp();
  const [role, setRole] = useState(promote ? "moderator" : account.role);
  const [status, setStatus] = useState(account.status);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(null);
  useEffect(() => () => pending.current?.abort(), []);
  const own = account.id === profile.id;
  async function save(event) {
    event.preventDefault();
    if (pending.current || blocked || own) return;
    if (!reason.trim()) { setError("Enter a reason for this account change."); return; }
    if (role === account.role && status === account.status) { setError("Choose a different role or account status."); return; }
    const controller = new AbortController(); pending.current = controller; setBusy(true); setError("");
    try {
      const response = await writeData(`admin/users/${encodeURIComponent(account.id)}`, { method: "PATCH", body: { role, status, reason: reason.trim(), updated_at: account.updated_at }, signal: controller.signal });
      if (controller.signal.aborted) return;
      if (response !== null) throw new Error("Unable to verify the save response.");
      const saved = await readData(`admin/users/${encodeURIComponent(account.id)}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (saved?.id !== account.id || saved.role !== role || saved.status !== status) throw new Error("The saved account differs from this change.");
      onSaved();
    } catch (failure) {
      if (controller.signal.aborted || failure.code === "CANCELLED") return;
      setBlocked(true); setError(`${failure.message} Reload the saved account before trying again.`);
    } finally { pending.current = null; if (!controller.signal.aborted) setBusy(false); }
  }
  return <form noValidate onSubmit={save}>
    <h3>{account.display_name}</h3><p className="hint">Account ID: {account.id}</p>
    <p>Current access: {account.role} · {account.status}</p>
    {own && <p className="hint">Use another admin account to change your own role or status.</p>}
    <fieldset disabled={busy || blocked || own} style={{ border: 0, padding: 0 }}>
      <label>Account role<select className="input" value={role} onChange={(event) => setRole(event.target.value)}><option value="user">Member</option><option value="moderator">Moderator</option>{account.role === "admin" && <option value="admin">Admin (existing role)</option>}</select></label>
      <label>Access status<select className="input" value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">Active</option><option value="suspended">Suspended</option></select></label>
      <label>Reason for change<textarea className="input" maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      <p className="hint">Saving grants the selected role's permissions. Suspended accounts cannot use protected features. Names and email addresses are not changed here.</p>
      <button className="btn blue sm" disabled={role === account.role && status === account.status}>{busy ? "Saving…" : "Save account changes"}</button>
    </fieldset>
    {error && <p role="alert">{error}</p>}
    {blocked && <button type="button" className="btn outline sm" disabled={busy} onClick={reload}>Reload saved account</button>}
  </form>;
}
function AccountAudit({ id }) {
  const [offset, setOffset] = useState(0);
  const result = useRemoteData(`admin/audit-logs?target_user_id=${encodeURIComponent(id)}&limit=10&offset=${offset}`, { collection: true });
  const rows = result.data || [];
  return <section aria-label="Account change history" style={{ marginTop: 24 }}><h3>Account change history</h3><RemoteState {...result} />
    {rows.map((row) => <div className="lrow" key={row.id}><div><b>{row.actor?.display_name || "Admin"}</b> · {new Date(row.created_at).toLocaleString()}<p>{row.old_values?.role} / {row.old_values?.status} → {row.new_values?.role} / {row.new_values?.status}</p><p>{row.reason}</p></div></div>)}
    {result.data && !rows.length && <p>No saved account changes on this page.</p>}
    <Pagination offset={offset} count={rows.length} size={10} onChange={setOffset} loading={result.loading || Boolean(result.error)} />
  </section>;
}
