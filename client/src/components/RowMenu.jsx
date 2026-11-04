import React, { useCallback, useEffect, useId, useRef, useState } from "react";

// A small "more actions" (⋯) menu for a list row. `items` are { label, onSelect, danger }.
// Menu button pattern: arrow keys, Home/End, Escape (focus returns to the button), and a click outside closes it.
export default function RowMenu({ label, items }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const list = useRef(null);
  const menuId = useId();
  const entries = () => [...(list.current?.querySelectorAll('[role="menuitem"]') || [])];
  const close = useCallback(() => { setOpen(false); trigger.current?.focus(); }, []);
  useEffect(() => {
    if (!open) return undefined;
    entries()[0]?.focus();
    const away = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  const onKeyDown = (event) => {
    const all = entries();
    const at = all.indexOf(document.activeElement);
    if (event.key === "Escape") { event.preventDefault(); close(); }
    else if (event.key === "Tab") setOpen(false);
    else if (event.key === "ArrowDown") { event.preventDefault(); all[(at + 1) % all.length]?.focus(); }
    else if (event.key === "ArrowUp") { event.preventDefault(); all[(at - 1 + all.length) % all.length]?.focus(); }
    else if (event.key === "Home") { event.preventDefault(); all[0]?.focus(); }
    else if (event.key === "End") { event.preventDefault(); all[all.length - 1]?.focus(); }
  };
  return <div className="row-menu" ref={root}>
    <button ref={trigger} type="button" className="row-menu__btn" aria-label={label} aria-haspopup="menu" aria-expanded={open}
      aria-controls={open ? menuId : undefined} onClick={() => setOpen((value) => !value)}>
      <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
    </button>
    {open && <div ref={list} id={menuId} className="row-menu__list" role="menu" aria-label={label} onKeyDown={onKeyDown}>
      {items.map((item) => <button key={item.label} type="button" role="menuitem" className={`row-menu__item${item.danger ? " row-menu__item--danger" : ""}`}
        onClick={() => { setOpen(false); trigger.current?.focus(); item.onSelect(); }}>{item.label}</button>)}
    </div>}
  </div>;
}
