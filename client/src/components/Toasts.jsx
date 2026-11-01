import React from "react";
import { useApp } from "../context/AppContext.jsx";

const ICON = {
  success: <><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16.2 9.6"/></>,
  error: <><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.4v.1"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.6v.1"/></>,
};

function ToastItem({ toast, dismiss, pause, resume }) {
  const leave = (event) => { if (!event.currentTarget.contains(event.relatedTarget)) resume(toast.id); };
  return <div className={`toast-item toast-${toast.type}`} onMouseEnter={() => pause(toast.id)} onMouseLeave={() => resume(toast.id)}
    onFocus={() => pause(toast.id)} onBlur={leave} onKeyDown={(event) => { if (event.key === "Escape") dismiss(toast.id); }}>
    <svg className="toast-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON[toast.type]}</svg>
    <p className="toast-message">{toast.message}</p>
    {toast.action && <button type="button" className="toast-action" onClick={() => { toast.action.onClick(); dismiss(toast.id); }}>{toast.action.label}</button>}
    <button type="button" className="toast-close" aria-label="Dismiss notification" onClick={() => dismiss(toast.id)}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>
  </div>;
}

// Two live regions that are always on the page: new messages are announced politely, and errors
// assertively. They use aria-live without a status/alert role, so they never get mistaken for the
// page's own status and alert messages. Messages are never replaced silently, so every notice is read once.
export default function Toasts() {
  const { toasts = [], dismissToast = () => {}, pauseToast = () => {}, resumeToast = () => {} } = useApp();
  const render = (toast) => <ToastItem key={toast.id} toast={toast} dismiss={dismissToast} pause={pauseToast} resume={resumeToast} />;
  return <div className="toast-region">
    <div className="toast-stack" aria-live="assertive" aria-atomic="true">{toasts.filter((toast) => toast.type === "error").map(render)}</div>
    <div className="toast-stack" aria-live="polite">{toasts.filter((toast) => toast.type !== "error").map(render)}</div>
  </div>;
}
