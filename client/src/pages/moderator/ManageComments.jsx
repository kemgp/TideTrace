import React, { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";

export default function ManageComments() {
  const { comments, resolveFlaggedComment, showToast } = useApp();
  const [status, setStatus] = useState("open");
  const visible = comments.filter((comment) => comment.status === status);
  const resolve = (id, action) => {
    resolveFlaggedComment(id, action);
    showToast(action === "removed" ? "Demo comment removed for this session" : "Demo comment kept for this session");
  };
  return <div className="wrap mod-narrow">
    <div className="vhead"><span className="eyebrow teale">Manage comments</span><h2>Flagged comments</h2><p>Comments reported by the community. Review each one — keep it or remove it.</p></div>
    <div className="chiprow mod-status-tabs" aria-label="Comment status">{[["open", "Flagged"], ["kept", "Kept"], ["removed", "Removed"]].map(([value, label]) => <button key={value} className={`chip ${status === value ? "on" : ""}`} aria-pressed={status === value} onClick={() => setStatus(value)}>{label}</button>)}</div>
    <p className="hint mod-demo-note">Demo comments. Actions update this session only; live reports are handled in Reports.</p>
    <div className="mod-comment-list">
      {visible.map((comment) => <article className="card mod-comment-card" key={comment.id} aria-label={`Comment by ${comment.who}`}>
        <div className="mod-card-top"><h3>On: {comment.trace}</h3>{comment.when && <span className="hint">{comment.when}</span>}</div>
        <div className="mod-comment-author"><span className="mod-comment-avatar" aria-hidden="true">{comment.who.charAt(0)}</span><div><strong>{comment.who}</strong><p>{comment.text}</p></div></div>
        <div className="mod-reason"><span className="lbl">Flag reason</span><p>{comment.reason || "No report reason supplied."}</p></div>
        {status === "open" ? <div className="row"><button className="btn teal sm" onClick={() => resolve(comment.id, "kept")}>Keep comment</button><button className="btn clay sm" onClick={() => resolve(comment.id, "removed")}>Remove comment</button></div> : <span className={`badge ${status === "kept" ? "approved" : "removed"}`}>{status}</span>}
      </article>)}
      {!visible.length && <div className="card mod-empty" role="status">{status === "open" ? "No flagged comments — the conversation is healthy." : `No ${status} comments in this session.`}</div>}
    </div>
  </div>;
}
