import { useMemo } from "react";
import { useApp } from "../context/AppContext.jsx";

// Typed helpers: toast.success("Saved"), toast.error("..."), toast.info("..."). Errors from a form
// the user just submitted belong next to that form; use error toasts for background failures only.
export default function useToast() {
  const { showToast, dismissToast } = useApp();
  return useMemo(() => ({
    success: (message, options) => showToast?.({ ...options, message, type: "success" }),
    error: (message, options) => showToast?.({ ...options, message, type: "error" }),
    info: (message, options) => showToast?.({ ...options, message, type: "info" }),
    dismiss: (id) => dismissToast?.(id),
  }), [showToast, dismissToast]);
}
