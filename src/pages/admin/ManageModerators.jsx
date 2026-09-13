import React, { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";

const ALL_PERMS = ["Review traces", "Manage comments", "Manage reports", "View analytics"];

export default function ManageModerators() {
  const { moderators, addModerator, showToast } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [perms, setPerms] = useState(["Review traces", "Manage comments", "Manage reports"]);

  const togglePerm = (p) => setPerms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const save = () => {
    if (!name || !email) return;
    addModerator({ name, email, permissions: perms });
    showToast("Moderator added");
    setOpen(false);
    setName("");
    setEmail("");
    setPerms(["Review traces", "Manage comments", "Manage reports"]);
  };

  return (
    <div className="wrap">
      <div className="vhead">
        <div className="headrow">
          <div>
            <span className="eyebrow claye">Manage moderators</span>
            <h2>Moderation team</h2>
            <p>Add moderators, assign permissions, and monitor their activity.</p>
          </div>
          <button className="btn blue sm" onClick={() => setOpen(true)}>＋ Add moderator</button>
        </div>
      </div>

      <div className="card">
        {moderators.map((m) => (
          <div className="lrow" key={m.id}>
            <span className="avatar" style={{ background: "var(--teal)" }} />
            <div className="grow">
              <div className="t">{m.name}</div>
              <div className="m">
                <span>{m.email}</span> · <span>{m.reviewed} reviewed</span>
              </div>
              <div className="chiprow" style={{ marginTop: 6 }}>
                {m.permissions.map((p) => <span key={p} className="chip on">{p}</span>)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {open && (
        <div className="modal" style={{ display: "grid" }}>
          <div className="mcard">
            <h3>Add moderator</h3>
            <div className="fgroup"><label>Full name</label><input className="input" placeholder="Juana dela Cruz" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="fgroup"><label>Email</label><input className="input" placeholder="juana@tidetrace.app" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <span className="lbl">Assign permissions</span>
            <div className="chiprow">
              {ALL_PERMS.map((p) => (
                <button key={p} type="button" className={`chip ${perms.includes(p) ? "on" : ""}`} onClick={() => togglePerm(p)}>{p}</button>
              ))}
            </div>
            <div className="mrow" style={{ marginTop: 20 }}>
              <button className="btn outline sm" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn blue sm" onClick={save}>Save moderator</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
