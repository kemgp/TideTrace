import React, { useState } from "react";

export default function CommentSection({ comments, onAdd }) {
  const [text, setText] = useState("");

  const send = () => {
    if (!text.trim()) return;
    onAdd(text.trim());
    setText("");
  };

  return (
    <div>
      <span className="lbl">Comments ({comments.length})</span>
      <div style={{ display: "grid", gap: 12 }}>
        {comments.map((c, i) => (
          <div className="comment" key={i}>
            <span className="avatar" style={{ background: "var(--tan)" }} />
            <div className="body">
              <span className="who">{c.who}</span>
              <span className="when">{c.when}</span>
              <p>{c.text}</p>
            </div>
          </div>
        ))}
        {comments.length === 0 && <p className="hint">No comments yet — be the first to say something.</p>}
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Add a comment…"
        />
        <button className="btn blue sm" onClick={send}>Send</button>
      </div>
    </div>
  );
}
