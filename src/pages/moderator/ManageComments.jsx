import React from "react";
import { useApp } from "../../context/AppContext.jsx";

export default function ManageComments() {
  const { comments, resolveFlaggedComment, showToast } = useApp();
  const open = comments.filter((c) => c.status === "open");

  const resolve = (id, action) => {
    resolveFlaggedComment(id, action);
    showToast(action === "removed" ? "Comment removed" : "Comment kept");
  };

  return (
    <div className="wrap" style={{ maxWidth: 760 }}>
      <div className="vhead">
        <span className="eyebrow teale">Manage comments</span>
        <h2>Flagged comments</h2>
        <p>Comments reported by the community. Review each one — keep it or remove it.</p>
      </div>

      {open.length ? (
        <div className="card">
          {open.map((c) => (
            <div className="lrow" key={c.id}>
              <div className="grow">
                <div className="t">{c.who}</div>
                <div className="m">on “{c.trace}”</div>
                <div className="flag"><b>Comment</b>{c.text}</div>
              </div>
              <div className="act">
                <button className="mini teal" onClick={() => resolve(c.id, "kept")}>Keep</button>
                <button className="mini clay" onClick={() => resolve(c.id, "removed")}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="ph" style={{ marginTop: 10 }}>No flagged comments — the conversation is healthy.</div>
      )}
    </div>
  );
}
