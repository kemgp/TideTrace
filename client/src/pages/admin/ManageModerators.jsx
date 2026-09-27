import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";

const ALL_PERMS = ["Review traces", "Manage comments", "Manage reports", "View analytics"];
const empty = { name: "", email: "", permissions: ALL_PERMS.slice(0, 3) };

export default function ManageModerators() {
  const { moderators, addModerator, editModerator, removeModerator, showToast } = useApp();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [removing, setRemoving] = useState(null);
  const dialog = useRef(null);
  const removeDialog = useRef(null);
  useEffect(() => { if (params.get("add") === "1") { setEditing("new"); setForm(empty); setParams({}, { replace: true }); } }, [params, setParams]);
  useEffect(() => { if (editing && !dialog.current.open) dialog.current.showModal(); }, [editing]);
  useEffect(() => { if (removing && !removeDialog.current.open) removeDialog.current.showModal(); }, [removing]);
  const close = () => { dialog.current.close(); setEditing(null); };
  const save = (event) => {
    event.preventDefault();
    const values = { ...form, name: form.name.trim(), email: form.email.trim() };
    if (!values.name) return;
    if (editing === "new") addModerator(values); else editModerator(editing, values);
    showToast("Demo moderator updated for this session"); close();
  };
  return <div className="wrap">
    <div className="vhead headrow"><div><span className="eyebrow claye">Manage moderators</span><h2>Moderation team</h2><p>Add moderators, assign permissions, and monitor their activity.</p></div><button className="btn blue sm" onClick={() => { setForm(empty); setEditing("new"); }}>＋ Add moderator</button></div>
    <div className="card">
      {!moderators.length && <p>No demo moderators. Add a moderator to get started.</p>}
      {moderators.map((mod) => <div className="lrow" key={mod.id}>
        <span className="avatar" style={{ background: "var(--teal)" }}>{mod.name.charAt(0)}</span>
        <div className="grow"><div className="t">{mod.name}</div><div className="m">{mod.email} · {mod.reviewed} reviewed</div><div className="chiprow" style={{ marginTop: 6 }}>{mod.permissions.map((permission) => <span key={permission} className="chip on">{permission}</span>)}</div></div>
        <div className="act"><button className="mini blue" onClick={() => { setForm({ name: mod.name, email: mod.email, permissions: [...mod.permissions] }); setEditing(mod.id); }}>Edit</button><button className="mini clay" onClick={() => setRemoving(mod)}>Remove</button></div>
      </div>)}
    </div>
    <p className="hint admin-note">Demo team. Changes last for this session and do not grant or revoke real account access.</p>
    <dialog ref={dialog} aria-labelledby="moderator-dialog-title" className="admin-dialog" onCancel={() => setEditing(null)}>
      <form onSubmit={save}>
        <h3 id="moderator-dialog-title">{editing === "new" ? "Add moderator" : "Edit moderator"}</h3>
        <label className="fgroup">Full name<input autoFocus className="input" placeholder="Juana dela Cruz" required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label className="fgroup">Email<input type="email" className="input" placeholder="juana@tidetrace.app" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <span className="lbl">Assign permissions</span><div className="chiprow">{ALL_PERMS.map((permission) => <button type="button" key={permission} aria-pressed={form.permissions.includes(permission)} className={`chip ${form.permissions.includes(permission) ? "on" : ""}`} onClick={() => setForm({ ...form, permissions: form.permissions.includes(permission) ? form.permissions.filter((item) => item !== permission) : [...form.permissions, permission] })}>{permission}</button>)}</div>
        <div className="mrow"><button type="button" className="btn outline sm" onClick={close}>Cancel</button><button className="btn blue sm" type="submit">Save moderator</button></div>
      </form>
    </dialog>
    <dialog ref={removeDialog} aria-labelledby="remove-moderator-title" className="admin-dialog" onCancel={() => setRemoving(null)}><h3 id="remove-moderator-title">Remove moderator?</h3><p>Remove {removing?.name} from this demo team?</p><div className="mrow"><button className="btn outline sm" onClick={() => { removeDialog.current.close(); setRemoving(null); }}>Cancel</button><button className="btn clay sm" onClick={() => { removeModerator(removing.id); removeDialog.current.close(); setRemoving(null); showToast("Demo moderator removed"); }}>Remove moderator</button></div></dialog>
  </div>;
}
