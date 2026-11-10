import React, { useId, useLayoutEffect, useRef } from "react";
import Button from "./Button.jsx";
import "./NavigationGuard.css";

// A modal yes/no question. The parent owns the request: it passes `busy` and `error` and closes the dialog itself.
// Focus starts on Cancel and returns to whatever opened the dialog. Use variant "danger" only for destructive actions.
export default function ConfirmDialog({ title, children, confirmLabel, variant = "blue", busy = false, error = "", onConfirm, onCancel }) {
  const titleId = useId();
  const descriptionId = useId();
  const dialog = useRef(null);
  const cancel = useRef(null);
  useLayoutEffect(() => {
    const initiator = document.activeElement;
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    cancel.current.focus();
    return () => { element.close(); document.body.style.overflow = overflow; if (initiator?.isConnected) initiator.focus(); };
  }, []);
  return <dialog ref={dialog} className="leave-dialog" aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}>
    <h2 id={titleId}>{title}</h2>
    <div id={descriptionId}>{children}</div>
    {error && <p role="alert" className="err">{error}</p>}
    <div className="leave-dialog-actions">
      <Button ref={cancel} type="button" variant="outline" disabled={busy} onClick={onCancel}>Cancel</Button>
      <Button type="button" variant={variant} loading={busy} onClick={onConfirm}>{confirmLabel}</Button>
    </div>
  </dialog>;
}
