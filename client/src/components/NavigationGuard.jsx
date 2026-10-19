import React, { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useBlocker } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import "./NavigationGuard.css";

const GuardContext = createContext(null);
const identity = (account) => account?.profile?.id && account?.role ? `${account.profile.id}:${account.role}` : null;

export default function NavigationGuard({ children }) {
  const { getCurrentAccount } = useApp();
  const entries = useRef(new Set());
  const initiator = useRef(null);
  const attemptedOwner = useRef(null);
  const clicked = useRef(null);
  const [, changed] = useState(0);
  const notify = useCallback(() => changed(value => value + 1), []);
  const currentIdentity = identity(getCurrentAccount());
  const pending = useCallback(() => {
    // Read the session synchronously: logout can navigate in the same event.
    const owner = identity(getCurrentAccount());
    return owner ? [...entries.current].filter(entry => entry.when && entry.owner === owner) : [];
  }, [getCurrentAccount]);
  const register = useCallback((entry) => {
    entry.owner = identity(getCurrentAccount());
    entries.current.add(entry);
    notify();
    return () => { entries.current.delete(entry); notify(); };
  }, [getCurrentAccount, notify]);
  const blocker = useBlocker(useCallback(({ currentLocation, nextLocation }) => {
    // Hash/search changes on these editors keep the same fields mounted.
    if (currentLocation.pathname === nextLocation.pathname) return false;
    if (!pending().length) return false;
    attemptedOwner.current = identity(getCurrentAccount());
    initiator.current = clicked.current?.isConnected ? clicked.current : document.activeElement;
    clicked.current = null;
    return true;
  }, [pending, getCurrentAccount]));
  const blocked = blocker.state === "blocked";
  const protectedEntries = pending();
  useEffect(() => {
    if (blocked && !pending().length) {
      // A confirmed background save can finish while the dialog is open.
      // Session/access changes instead leave redirects to the access-control routes.
      if (currentIdentity === attemptedOwner.current) blocker.proceed();
      else blocker.reset();
    }
  }, [blocked, blocker, pending, currentIdentity, protectedEntries.length]);
  useEffect(() => {
    const remember = (event) => {
      const control = event.target.closest?.("a, button") || null;
      clicked.current = control;
      queueMicrotask(() => { if (clicked.current === control) clicked.current = null; });
    };
    const warn = (event) => {
      if (!pending().length) return;
      event.preventDefault(); event.returnValue = "";
    };
    document.addEventListener("click", remember, true);
    window.addEventListener("beforeunload", warn);
    return () => { document.removeEventListener("click", remember, true); window.removeEventListener("beforeunload", warn); };
  }, [pending]);
  const context = useMemo(() => ({ register, notify }), [register, notify]);
  const keep = () => blocker.reset();
  const discard = () => {
    pending().forEach(entry => { entry.when = false; entry.released = true; entry.onDiscard?.(); });
    blocker.proceed();
  };
  return <GuardContext.Provider value={context}>
    {children}
    {blocked && protectedEntries.length > 0 && <LeaveDialog onKeep={keep} onDiscard={discard} initiator={initiator.current}
      pendingRequest={protectedEntries.some(entry => entry.pendingRequest)} />}
  </GuardContext.Provider>;
}

// Outside the application shell, display-only component tests need no router guard.
export function useUnsavedChanges(when, { onDiscard, pendingRequest = false } = {}) {
  const guard = useContext(GuardContext);
  const entry = useRef({ when: false, released: false });
  useLayoutEffect(() => guard?.register(entry.current), [guard]);
  useLayoutEffect(() => {
    if (!when) entry.current.released = false;
    const next = Boolean(when) && !entry.current.released;
    const previous = entry.current.when;
    Object.assign(entry.current, { when: next, onDiscard, pendingRequest });
    if (next !== previous) guard?.notify();
  });
  // Clear this entry synchronously before a confirmed-save redirect.
  return useCallback(() => { entry.current.when = false; entry.current.released = true; guard?.notify(); }, [guard]);
}

function LeaveDialog({ onKeep, onDiscard, initiator, pendingRequest }) {
  const title = useId();
  const description = useId();
  const dialog = useRef(null);
  const keep = useRef(null);
  const cancel = useRef(onKeep);
  cancel.current = onKeep;
  useLayoutEffect(() => {
    const overlay = dialog.current.parentElement;
    const background = [...document.body.children].filter(node => node !== overlay);
    const previous = background.map(node => [node, node.hasAttribute("inert")]);
    background.forEach(node => node.setAttribute("inert", ""));
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    keep.current.focus();
    const keyboard = (event) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancel.current(); }
      if (event.key !== "Tab") return;
      const buttons = [...dialog.current.querySelectorAll("button")];
      const first = buttons[0], last = buttons.at(-1);
      if (!dialog.current.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const contain = (event) => { if (!dialog.current.contains(event.target)) keep.current.focus(); };
    document.addEventListener("keydown", keyboard, true);
    document.addEventListener("focusin", contain);
    return () => {
      document.removeEventListener("keydown", keyboard, true);
      document.removeEventListener("focusin", contain);
      previous.forEach(([node, inert]) => { if (!inert) node.removeAttribute("inert"); });
      document.body.style.overflow = overflow;
      if (initiator?.isConnected) initiator.focus({ preventScroll: true });
    };
  }, [initiator]);
  return createPortal(<div className="leave-dialog-overlay">
    <section ref={dialog} className="leave-dialog" role="alertdialog" aria-modal="true" aria-labelledby={title} aria-describedby={description}>
      <h2 id={title}>Unsaved changes</h2>
      <div id={description}><p>You have unsaved changes. Leave this page and discard them?</p>
        {pendingRequest && <p>A request is in progress. It may still save on the server. Check the saved record before trying again.</p>}</div>
      <div className="leave-dialog-actions">
        <button ref={keep} className="btn outline" type="button" onClick={onKeep}>Keep editing</button>
        <button className="btn clay" type="button" onClick={onDiscard}>Discard changes</button>
      </div>
    </section>
  </div>, document.body);
}
