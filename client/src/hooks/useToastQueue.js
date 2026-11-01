import { useCallback, useEffect, useRef, useState } from "react";

export const MAX_TOASTS = 3;
// Success and info confirmations disappear on their own; errors stay until dismissed.
export const TOAST_DURATION = { success: 4000, info: 6000, error: 0 };
const TYPES = Object.keys(TOAST_DURATION);

// Owns the toast list and its timers. Hovering or focusing a toast pauses its countdown.
export default function useToastQueue() {
  const [toasts, setToasts] = useState([]);
  const list = useRef([]);
  const timers = useRef(new Map());
  const counter = useRef(0);

  const commit = useCallback((next) => { list.current = next; setToasts(next); }, []);
  const clear = useCallback((id) => {
    const entry = timers.current.get(id);
    if (entry) { clearTimeout(entry.timer); timers.current.delete(id); }
  }, []);
  const dismissToast = useCallback((id) => {
    clear(id);
    commit(list.current.filter((toast) => toast.id !== id));
  }, [clear, commit]);
  const arm = useCallback((id, ms) => {
    clear(id);
    if (!ms) return;
    timers.current.set(id, { timer: setTimeout(() => dismissToast(id), ms), remaining: ms, startedAt: Date.now() });
  }, [clear, dismissToast]);

  // showToast("Saved") or showToast({ message, type: "success" | "error" | "info", action, duration }).
  // A plain string is a success message. The same message again refreshes the existing toast.
  const showToast = useCallback((input, options) => {
    const spec = typeof input === "string" ? { ...options, message: input } : { ...input };
    const message = String(spec.message ?? "").trim();
    if (!message) return null;
    const type = TYPES.includes(spec.type) ? spec.type : "success";
    const duration = Number.isFinite(spec.duration) && spec.duration >= 0 ? spec.duration : TOAST_DURATION[type];
    const action = spec.action?.label && typeof spec.action.onClick === "function" ? { label: String(spec.action.label), onClick: spec.action.onClick } : null;
    const existing = list.current.find((toast) => toast.message === message && toast.type === type);
    const id = existing ? existing.id : ++counter.current;
    let next = existing ? list.current.map((toast) => (toast.id === id ? { ...toast, action } : toast)) : [...list.current, { id, message, type, action }];
    while (next.length > MAX_TOASTS) { clear(next[0].id); next = next.slice(1); }
    commit(next);
    arm(id, duration);
    return id;
  }, [arm, clear, commit]);

  const pauseToast = useCallback((id) => {
    const entry = timers.current.get(id);
    if (!entry || !entry.timer) return;
    clearTimeout(entry.timer);
    entry.timer = null;
    entry.remaining = Math.max(1500, entry.remaining - (Date.now() - entry.startedAt));
  }, []);
  const resumeToast = useCallback((id) => {
    const entry = timers.current.get(id);
    if (!entry || entry.timer) return;
    entry.startedAt = Date.now();
    entry.timer = setTimeout(() => dismissToast(id), entry.remaining);
  }, [dismissToast]);

  useEffect(() => {
    const active = timers.current;
    return () => { active.forEach((entry) => clearTimeout(entry.timer)); active.clear(); };
  }, []);

  return { toasts, showToast, dismissToast, pauseToast, resumeToast };
}
