import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
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
  const [role, setRole] = useState(() => window.localStorage.getItem("tidetrace-role"));
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

  const login = useCallback((chosenRole) => {
    setRole(chosenRole);
    window.localStorage.setItem("tidetrace-role", chosenRole);
  }, []);

  const logout = useCallback(() => {
    setRole(null);
    window.localStorage.removeItem("tidetrace-role");
  }, []);

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
      login,
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
      role, toast, traces, tides, comments, reports, notifications, history, logs, users, moderators, categories,
      login, logout, showToast, addTrace, decideTrace, addComment, toggleTideProgress, addTide,
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
