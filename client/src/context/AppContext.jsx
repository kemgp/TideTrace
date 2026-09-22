import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, authRequest, loadAccount } from "../api/auth.js";
import {
  categories as seedCategories,
  users as seedUsers,
  moderators as seedModerators,
  initialTraces,
  initialTides,
  initialComments,
  initialReports,
  initialNotifications,
  initialHistory,
  initialLogs,
} from "../data/mockData.js";

const AppContext = createContext(null);

const ROLE_NAMES = {
  user: "Ana Ramos",
  mod: "Rica Lopez",
  admin: "Admin Doy",
};

export function AppProvider({ children }) {
  const [account, setAccount] = useState(null);
  const authAttempt = useRef(0);
  const role = account?.role || null;
  const profile = account?.profile || null;
  const [toast, setToast] = useState("");

  const [traces, setTraces] = useState(initialTraces);
  const [tides, setTides] = useState(initialTides);
  const [comments, setComments] = useState(initialComments);
  const [reports, setReports] = useState(initialReports);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [history, setHistory] = useState(initialHistory);
  const [logs, setLogs] = useState(initialLogs);
  const [users, setUsers] = useState(seedUsers);
  const [moderators, setModerators] = useState(seedModerators);
  const [categories, setCategories] = useState(seedCategories);

  const showToast = useCallback((msg) => {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(""), 2600);
  }, []);

  useEffect(() => {
    try { window.localStorage.removeItem("tidetrace-role"); } catch { /* Storage may be unavailable. */ }
  }, []);

  const authenticate = useCallback(async (getSession) => {
    const attempt = ++authAttempt.current;
    const session = await getSession();
    if (!session) return null;
    const next = await loadAccount(session);
    if (attempt !== authAttempt.current) throw new ApiError("Sign-in was cancelled. Please try again.", "CANCELLED");
    setAccount(next);
    return next.role;
  }, []);

  const login = useCallback((email, password) => authenticate(async () => {
    const data = await authRequest("login", { body: { email: email.trim(), password } });
    if (!data.session) throw new ApiError("No sign-in session was returned. Please try again.", "MISSING_SESSION");
    return data.session;
  }), [authenticate]);

  const register = useCallback((fields) => authenticate(async () => {
    const data = await authRequest("register", { body: fields });
    return data.session;
  }), [authenticate]);

  const verifySignup = useCallback((email, token) => authenticate(async () => {
    const data = await authRequest("verify", { body: { email, token, type: "signup" } });
    if (!data.session) throw new ApiError("No sign-in session was returned. Please log in again.", "MISSING_SESSION");
    return data.session;
  }), [authenticate]);

  const confirmSession = useCallback((session) => authenticate(() => session), [authenticate]);
  const resendConfirmation = useCallback((email) => authRequest("resend", { body: { email } }), []);

  const clearSession = useCallback(() => {
    ++authAttempt.current;
    setAccount(null);
  }, []);

  const logout = useCallback(async () => {
    clearSession();
    if (!account?.accessToken) return;
    try { await authRequest("logout", { token: account.accessToken, method: "POST" }); }
    catch (error) {
      if (error.status !== 401) showToast("Signed out here. The server could not confirm sign-out; your session will expire automatically.");
    }
  }, [account, clearSession, showToast]);

  useEffect(() => {
    if (!account) return undefined;
    const timer = window.setTimeout(() => {
      ++authAttempt.current;
      setAccount(null);
      showToast("Your session expired. Please log in again.");
    }, Math.min(2147483647, Math.max(0, account.expiresAt * 1000 - Date.now())));
    return () => window.clearTimeout(timer);
  }, [account, showToast]);

  const addTrace = useCallback((trace) => {
    const id = "t" + (Math.floor(Math.random() * 90000) + 10000);
    setTraces((prev) => [
      { id, status: "pending", when: "just now", comments: [], author: ROLE_NAMES.user, ...trace },
      ...prev,
    ]);
    return id;
  }, []);

  const decideTrace = useCallback((id, status, note) => {
    setTraces((prev) => prev.map((t) => (t.id === id ? { ...t, status, note: note || t.note } : t)));
    setHistory((prev) => {
      const t = traces.find((tt) => tt.id === id);
      if (!t) return prev;
      return [
        { id: "h" + Date.now(), title: t.title, moderator: ROLE_NAMES.mod, decision: status, when: "just now", note: note || "" },
        ...prev,
      ];
    });
    setLogs((prev) => [{ id: "g" + Date.now(), text: `${ROLE_NAMES.mod} marked a trace as ${status}.`, when: "just now" }, ...prev]);
  }, [traces]);

  const addComment = useCallback((traceId, text) => {
    setTraces((prev) =>
      prev.map((t) =>
        t.id === traceId
          ? { ...t, comments: [...t.comments, { who: ROLE_NAMES.user, when: "just now", text }] }
          : t
      )
    );
  }, []);

  const resolveFlaggedComment = useCallback((id, action) => {
    setComments((prev) => prev.map((c) => (c.id === id ? { ...c, status: action } : c)));
  }, []);

  const resolveReport = useCallback((id, action) => {
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status: action } : r)));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  }, []);

  const toggleTideProgress = useCallback((id, progress) => {
    setTides((prev) => prev.map((t) => (t.id === id ? { ...t, progress } : t)));
  }, []);

  const suspendUser = useCallback((id) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, status: u.status === "active" ? "suspended" : "active" } : u))
    );
  }, []);

  const editUser = useCallback((id, changes) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...changes } : u)));
  }, []);

  const addModerator = useCallback((mod) => {
    setModerators((prev) => [...prev, { id: "m" + Date.now(), reviewed: 0, ...mod }]);
    setLogs((prev) => [{ id: "g" + Date.now(), text: `${ROLE_NAMES.admin} added moderator ${mod.name}.`, when: "just now" }, ...prev]);
  }, []);

  const addTide = useCallback((tide) => {
    setTides((prev) => [{ id: "l" + Date.now(), progress: 0, ...tide }, ...prev]);
  }, []);

  const addCategory = useCallback((name) => {
    setCategories((prev) => (prev.includes(name) ? prev : [...prev.filter((c) => c !== "Other"), name, "Other"]));
  }, []);

  const value = useMemo(
    () => ({
      role,
      profile,
      login,
      register,
      verifySignup,
      confirmSession,
      clearSession,
      resendConfirmation,
      logout,
      toast,
      showToast,
      traces,
      addTrace,
      decideTrace,
      addComment,
      tides,
      toggleTideProgress,
      addTide,
      comments,
      resolveFlaggedComment,
      reports,
      resolveReport,
      notifications,
      markAllNotificationsRead,
      history,
      logs,
      users,
      suspendUser,
      editUser,
      moderators,
      addModerator,
      categories,
      addCategory,
    }),
    [
      role, profile, toast, traces, tides, comments, reports, notifications, history, logs, users, moderators, categories,
      login, register, verifySignup, confirmSession, clearSession, resendConfirmation, logout, showToast, addTrace, decideTrace, addComment, toggleTideProgress, addTide,
      resolveFlaggedComment, resolveReport, markAllNotificationsRead, suspendUser, editUser, addModerator, addCategory,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
