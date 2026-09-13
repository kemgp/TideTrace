
import React, { useMemo, useState } from "react";
import { useApp } from "../../context/AppContext.jsx";

export default function ManageUsers() {
  const { users, suspendUser, editUser, showToast } = useApp();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", barangay: "" });

  const filtered = useMemo(
    () => users.filter((u) => u.name.toLowerCase().includes(query.toLowerCase()) || u.email.toLowerCase().includes(query.toLowerCase())),
    [users, query]
  );

  const openEdit = (u) => {
    setEditing(u.id);
    setForm({ name: u.name, email: u.email, barangay: u.barangay });
  };

  const save = () => {
    editUser(editing, form);
    showToast("User updated");
    setEditing(null);
  };

  const editingUser = users.find((u) => u.id === editing);

  return (
    <div className="wrap">
      <div className="vhead">
        <div className="headrow">
          <div>
            <span className="eyebrow claye">Manage users</span>
            <h2>Community members</h2>
            <p>View, edit, suspend, or deactivate user accounts.</p>
          </div>
          <div className="search" style={{ maxWidth: 280 }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#6b7f9e" strokeWidth={2}>
              <circle cx={11} cy={11} r={7} /><path d="m21 21-4-4" />
            </svg>
            <input placeholder="Search users…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card">
        {filtered.map((u) => (
          <div className="lrow" key={u.id}>
            <span className="avatar" style={{ background: "var(--tan)" }} />
            <div className="grow">
              <div className="t">{u.name}</div>
              <div className="m">
                <span>{u.email}</span> · <span>{u.barangay}</span> · <span>{u.traces} traces</span>
                <span className={`badge ${u.status}`}>{u.status}</span>
              </div>
            </div>
            <div className="act">
              <button className="mini blue" onClick={() => openEdit(u)}>Edit</button>
              <button className="mini clay" onClick={() => { suspendUser(u.id); showToast(u.status === "active" ? "User suspended" : "User activated"); }}>
                {u.status === "active" ? "Suspend" : "Activate"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && editingUser && (
        <div className="modal" style={{ display: "grid" }}>
          <div className="mcard">
            <h3>Edit user</h3>
            <div className="fgroup"><label>Full name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="fgroup"><label>Email</label><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="fgroup"><label>Barangay / community</label><input className="input" value={form.barangay} onChange={(e) => setForm({ ...form, barangay: e.target.value })} /></div>
            <div className="mrow" style={{ justifyContent: "space-between" }}>
              <button
                className="btn outline sm"
                style={{ color: "var(--clay)", borderColor: "var(--clay)" }}
                onClick={() => { suspendUser(editingUser.id); setEditing(null); }}
              >
                Suspend / Activate
              </button>
              <div className="row">
                <button className="btn outline sm" onClick={() => setEditing(null)}>Cancel</button>
                <button className="btn blue sm" onClick={save}>Save changes</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}