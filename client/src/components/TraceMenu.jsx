import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import AdminIcon from "./AdminIcon.jsx";
import { useCopyLink } from "./TraceShareActions.jsx";

// "More actions" menu for a trace: Copy link for everyone, then Report (other members) or Delete (the author).
export default function TraceMenu({ canReport = false, canDelete = false, deleteDisabled = false, onReport, onDelete }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const list = useRef(null);
  const closeTimer = useRef(null);
  const menuId = useId();
  const { state, copy } = useCopyLink();
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  const close = useCallback(() => { clearTimeout(closeTimer.current); setOpen(false); trigger.current?.focus(); }, []);
  const items = () => [...list.current.querySelectorAll('[role="menuitem"]:not(:disabled)')];
  useEffect(() => {
    if (!open) return undefined;
    items()[0]?.focus();
    const away = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  const onKeyDown = (event) => {
    const all = items();
    const at = all.indexOf(document.activeElement);
    if (event.key === "Escape") { event.preventDefault(); close(); }
    else if (event.key === "Tab") setOpen(false);
    else if (event.key === "ArrowDown") { event.preventDefault(); all[(at + 1) % all.length]?.focus(); }
    else if (event.key === "ArrowUp") { event.preventDefault(); all[(at - 1 + all.length) % all.length]?.focus(); }
    else if (event.key === "Home") { event.preventDefault(); all[0]?.focus(); }
    else if (event.key === "End") { event.preventDefault(); all[all.length - 1]?.focus(); }
  };
  const choose = (action) => () => { setOpen(false); trigger.current?.focus(); action?.(); };
  const copyLink = async () => {
    await copy();
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(close, 1200);
  };
  const copyLabel = state === "copied" ? "Link copied" : state === "failed" ? "Couldn't copy. Use the address bar." : "Copy link";
  return <div className="trace-menu" ref={root}>
    <button ref={trigger} type="button" className="btn ghost trace-menu__btn" aria-label="More actions" aria-haspopup="menu"
      aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={() => setOpen((value) => !value)}>
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
    </button>
    {open && <div ref={list} id={menuId} className="trace-menu__list" role="menu" aria-label="Trace actions" onKeyDown={onKeyDown}>
      <button type="button" role="menuitem" className="trace-menu__item" onClick={copyLink}>
        <AdminIcon name={state === "copied" ? "check" : "link"} size={18} />{copyLabel}
      </button>
      {canReport && <button type="button" role="menuitem" className="trace-menu__item" onClick={choose(onReport)}><AdminIcon name="flag" size={18} />Report trace</button>}
      {canDelete && <button type="button" role="menuitem" className="trace-menu__item trace-menu__item--danger" disabled={deleteDisabled} onClick={choose(onDelete)}><AdminIcon name="trash" size={18} />Delete trace</button>}
      {state === "copied" && <span className="sr-only" role="status">Link copied to the clipboard.</span>}
    </div>}
  </div>;
}
