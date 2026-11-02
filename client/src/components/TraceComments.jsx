import { PAGE_SIZE } from "../api/pagination.js";
import React, { useEffect, useId, useRef, useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import useRemoteData from "../hooks/useRemoteData.js";
import ReportContent from "./ReportContent.jsx";
import RemoteState from "./RemoteState.jsx";
import AuthorAvatar from "./AuthorAvatar.jsx";
import EmptyState from "./EmptyState.jsx";
import RelativeTime from "./RelativeTime.jsx";

export default function TraceComments({ traceId }) {
  const { writeData, profile } = useApp();
  const [offset, setOffset] = useState(0);
  const result = useRemoteData(`traces/${encodeURIComponent(traceId)}/comments?limit=${PAGE_SIZE}&offset=${offset}`, { collection: true });
  // Pages accumulate into one thread; "Show more comments" asks for the next page.
  const [pages, setPages] = useState({});
  useEffect(() => { if (result.data) setPages((saved) => saved[offset] === result.data ? saved : { ...saved, [offset]: result.data }); }, [result.data, offset]);
  const counter = useId();
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
      setPages({});
      if (offset === 0) result.retry(); else setOffset(0);
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
  const offsets = Object.keys(pages).map(Number).sort((a, b) => a - b);
  const comments = offsets.flatMap((key) => pages[key]);
  const lastLoaded = offsets.at(-1);
  const hasMore = lastLoaded === undefined ? false : lastLoaded === offset ? pages[lastLoaded].length === PAGE_SIZE : true;
  const loadingMore = offset > 0 && result.loading;
  const remaining = 5000 - text.length;
  return <section className="trace-detail__comments" aria-label="Trace comments">
    <h3 className="trace-detail__comments-title">Comments{offsets.length ? ` (${comments.length}${hasMore ? "+" : ""})` : ""}</h3>
    {(!comments.length || result.error) && <RemoteState compact {...result} />}
    <div className="trace-detail__comment-list">
      {comments.map((comment) => <div className="comment" key={comment.id}>
        <AuthorAvatar authorId={comment.author_id || comment.author?.id} name={comment.author_id === profile?.id ? profile.display_name : comment.author?.display_name || "Community member"} url={comment.author?.avatar_url} />
        <div className="body"><span className="who">{comment.author_id === profile?.id ? "You" : comment.author?.display_name || "Community member"}</span>
          <RelativeTime className="when" value={comment.created_at} />
          <p>{comment.body}</p>
          {comment.author_id !== profile?.id && <ReportContent targetId={comment.id} type="comment" />}
        </div>
      </div>)}
      {offsets.length > 0 && !comments.length && <EmptyState className="empty-state--compact" title="No comments yet — be the first to say something." />}
    </div>
    {hasMore && !result.error && <button type="button" className="btn outline sm trace-detail__more" disabled={loadingMore} aria-busy={loadingMore || undefined} onClick={() => setOffset(lastLoaded + PAGE_SIZE)}>{loadingMore ? "Loading…" : "Show more comments"}</button>}
    {error && <p role="alert">{error}</p>}
    {notice && <p className="hint" role="status">{notice}</p>}
    <form className="trace-detail__comment-form" onSubmit={send}>
      <AuthorAvatar authorId={profile?.id} name={profile?.display_name} url={profile?.avatar_url} />
      <input className="input" aria-label="Add a comment" placeholder="Add a comment…" value={text} maxLength={5000} aria-describedby={remaining <= 500 ? counter : undefined} disabled={busy || uncertain} onChange={(event) => setText(event.target.value)} />
      <button className="btn blue sm" type="submit" disabled={busy || uncertain || !text.trim()}>{busy ? "Sending…" : "Send"}</button>
    </form>
    {remaining <= 500 && <p id={counter} className="hint trace-detail__counter">{remaining} characters left</p>}
  </section>;
}
