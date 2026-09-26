import React, { useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import useRemoteData from "../hooks/useRemoteData.js";
import RemoteState, { Pagination } from "./RemoteState.jsx";

export default function TraceComments({ traceId }) {
  const { writeData, profile } = useApp();
  const [offset, setOffset] = useState(0);
  const result = useRemoteData(`traces/${encodeURIComponent(traceId)}/comments?limit=25&offset=${offset}`, { collection: true });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);
  const send = async (event) => {
    event.preventDefault();
    if (!text.trim() || request.current || uncertain) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = await writeData(`traces/${encodeURIComponent(traceId)}/comments`, { method: "POST", body: { body: text.trim() }, signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!saved?.id || saved.trace_id !== traceId) throw Object.assign(new Error("Unable to confirm the comment."), { code: "INVALID_RESPONSE" });
      setText("");
      setNotice("Comment sent.");
      result.retry();
    } catch (failure) {
      if (controller.signal.aborted) return;
      const unknown = failure.code === "NETWORK_ERROR" || failure.code === "INVALID_RESPONSE" || failure.status >= 500;
      setUncertain(unknown);
      setError(unknown ? "We could not confirm whether your comment was saved. Reload this page and check the comments before sending again." : failure.message);
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  const comments = result.data || [];
  return <section className="trace-detail__comments" aria-label="Trace comments">
    <h3 className="lbl">Comments{result.data && offset === 0 && comments.length < 25 ? ` (${comments.length})` : ""}</h3>
    <RemoteState {...result} />
    <div className="trace-detail__comment-list">
      {comments.map((comment, index) => <div className="comment" key={comment.id}>
        <span className={`avatar trace-detail__avatar trace-detail__avatar--${index % 3}`} aria-hidden="true" />
        <div className="body"><span className="who">{comment.author_id === profile?.id ? "You" : comment.author?.display_name || "Community member"}</span>
          <time className="when" dateTime={comment.created_at}>{comment.created_at ? new Date(comment.created_at).toLocaleDateString() : ""}</time>
          <p>{comment.body}</p>
        </div>
      </div>)}
      {result.data && !comments.length && <p className="hint">{offset ? "No more comments." : "No comments yet — be the first to say something."}</p>}
    </div>
    {(offset > 0 || comments.length === 25) && <Pagination offset={offset} count={comments.length} size={25} loading={result.loading} onChange={setOffset} />}
    {error && <p role="alert">{error}</p>}
    {notice && <p className="hint" role="status">{notice}</p>}
    <form className="trace-detail__comment-form" onSubmit={send}>
      <input className="input" aria-label="Add a comment" placeholder="Add a comment…" value={text} maxLength={5000} disabled={busy || uncertain} onChange={(event) => setText(event.target.value)} />
      <button className="btn blue sm" type="submit" disabled={busy || uncertain || !text.trim()}>{busy ? "Sending…" : "Send"}</button>
    </form>
  </section>;
}
