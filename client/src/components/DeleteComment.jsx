import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import useToast from "../hooks/useToast.js";
import Button from "./Button.jsx";
import "./NavigationGuard.css";

export default function DeleteComment({ comment, onDeleted }) {
  const { profile } = useApp();
  const [open, setOpen] = useState(false);
  if (!profile?.id || comment.author_id !== profile.id) return null;
  return <>
    <button type="button" className="btn ghost sm comment-delete" aria-label="Delete comment" aria-haspopup="dialog" onClick={() => setOpen(true)}>Delete</button>
    {open && <DeleteCommentDialog comment={comment} onCancel={() => setOpen(false)} onDeleted={onDeleted} />}
  </>;
}

function DeleteCommentDialog({ comment, onCancel, onDeleted }) {
  const { writeData } = useApp();
  const toast = useToast();
  const title = useId();
  const description = useId();
  const dialog = useRef(null);
  const cancel = useRef(null);
  const request = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => request.current?.abort(), []);
  useLayoutEffect(() => {
    const initiator = document.activeElement;
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    cancel.current.focus();
    return () => { element.close(); document.body.style.overflow = overflow; if (initiator?.isConnected && (document.activeElement === element || element.contains(document.activeElement) || document.activeElement === document.body)) initiator.focus(); };
  }, []);
  const remove = async () => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError("");
    try {
      await writeData(`comments/${encodeURIComponent(comment.id)}`, { method: "DELETE", signal: controller.signal });
      if (controller.signal.aborted) return;
      dialog.current.close();
      onDeleted(comment.id);
      onCancel();
      toast.success("Comment deleted.");
    } catch (failure) {
      if (controller.signal.aborted || failure.code === "CANCELLED") return;
      if (failure.status === 404) {
        dialog.current.close();
        onDeleted(comment.id); onCancel(); toast.info("This comment no longer exists."); return;
      }
      setError(failure.message);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      request.current = null;
    }
  };
  return <dialog ref={dialog} className="leave-dialog" aria-labelledby={title} aria-describedby={description}
    onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}>
    <h2 id={title}>Delete this comment?</h2>
    <div id={description}><p>This can't be undone.</p>
    </div>
    {error && <p role="alert" className="comment-delete-error">{error}</p>}
    <div className="leave-dialog-actions">
      <Button ref={cancel} type="button" variant="outline" disabled={busy} onClick={onCancel}>Cancel</Button>
      <Button type="button" variant="danger" loading={busy} onClick={remove}>Delete</Button>
    </div>
  </dialog>;
}
