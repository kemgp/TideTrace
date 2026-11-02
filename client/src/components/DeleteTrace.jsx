import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import useToast from "../hooks/useToast.js";
import Button from "./Button.jsx";
import "./NavigationGuard.css";

export default function DeleteTrace({ trace, onDeleted, disabled = false }) {
  const { profile } = useApp();
  const [open, setOpen] = useState(false);
  if (!profile?.id || trace.author_id !== profile.id || trace.deleted_at) return null;
  return <>
    <Button type="button" variant="danger" size="sm" disabled={disabled} onClick={() => setOpen(true)}>Delete</Button>
    {open && <DeleteDialog trace={trace} onCancel={() => setOpen(false)} onDeleted={onDeleted} />}
  </>;
}

function DeleteDialog({ trace, onCancel, onDeleted }) {
  const { writeData } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const title = useId();
  const description = useId();
  const dialog = useRef(null);
  const cancel = useRef(null);
  const request = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cleanupOnly, setCleanupOnly] = useState(false);
  useEffect(() => () => request.current?.abort(), []);
  useLayoutEffect(() => {
    const initiator = document.activeElement;
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    cancel.current.focus();
    return () => { element.close(); document.body.style.overflow = overflow; if (initiator?.isConnected) initiator.focus(); };
  }, []);
  const remove = async () => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError("");
    try {
      await writeData(`traces/${encodeURIComponent(trace.id)}${cleanupOnly ? "/photo-cleanup" : ""}`, {
        method: cleanupOnly ? "POST" : "DELETE", signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      onDeleted?.();
      navigate("/user/contributions");
      toast.success("Trace deleted.");
    } catch (failure) {
      if (controller.signal.aborted || failure.code === "CANCELLED") return;
      if (failure.status === 404) {
        // Retrying photo removal on a Trace with nothing left to clean means it is finished.
        if (cleanupOnly) { onDeleted?.(); navigate("/user/contributions"); toast.success("Trace deleted."); return; }
        // Already deleted elsewhere, or not available: nothing to retry, so leave the screen.
        onDeleted?.(); navigate("/user/contributions"); toast.info("This trace no longer exists."); return;
      }
      if (failure.code === "TRACE_PHOTO_CLEANUP_FAILED") setCleanupOnly(true);
      setError(failure.message);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      request.current = null;
    }
  };
  return <dialog ref={dialog} className="leave-dialog" aria-labelledby={title} aria-describedby={description}
    onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}>
    <h2 id={title}>Delete this trace?</h2>
    <div id={description}><p>This can't be undone.</p>
      {trace.status === "approved" && <p>It will no longer be visible to the community.</p>}
    </div>
    {error && <p role="alert" className="err">{error}</p>}
    <div className="leave-dialog-actions">
      <Button ref={cancel} type="button" variant="outline" disabled={busy} onClick={onCancel}>Cancel</Button>
      <Button type="button" variant="danger" loading={busy} onClick={remove}>{cleanupOnly ? "Retry photo removal" : "Delete"}</Button>
    </div>
  </dialog>;
}
