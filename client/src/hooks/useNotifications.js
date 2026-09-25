import { useCallback, useEffect, useRef, useState } from "react";

export default function useNotifications(owner, readData, writeData) {
  const [page, setPage] = useState({ owner, offset: 0 });
  const offset = page.owner === owner ? page.offset : 0;
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  const [action, setAction] = useState(null);
  const writing = useRef(false);
  const currentOwner = useRef(owner);
  currentOwner.current = owner;
  const key = `${owner}:${offset}:${revision}`;
  const refreshNotifications = useCallback(() => setRevision(n => n + 1), []);
  useEffect(() => {
    if (!owner) { setResult(null); setAction(null); return; }
    const controller = new AbortController();
    let active = true;
    Promise.all([
      readData(`notifications?limit=25&offset=${offset}`, { signal: controller.signal }),
      readData("notifications/unread-count", { signal: controller.signal }),
    ]).then(([rows, summary]) => {
      if (!Array.isArray(rows) || !Number.isInteger(summary?.count) || summary.count < 0) throw new Error("Unable to load notifications. Please try again.");
      if (active) setResult({ key, rows, count: summary.count });
    }).catch(error => { if (active) setResult({ key, rows: [], count: null, error: error.message }); });
    return () => { active = false; controller.abort(); };
  }, [owner, key, offset, readData]);
  useEffect(() => {
    if (!owner) return;
    const refresh = () => { if (document.visibilityState !== "hidden" && !writing.current) refreshNotifications(); };
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [owner, refreshNotifications]);
  const markNotificationsRead = useCallback(async (ids) => {
    if (!owner || writing.current) return;
    writing.current = true;
    setAction({ owner, busy: true });
    try {
      await writeData("notifications/read", { method: "POST", body: { ids } });
      if (currentOwner.current === owner) {
        // Patch only the affected rows after the server confirms the write.
        // Keep the list mounted so its highlight can transition without a reload.
        setResult(previous => {
          if (previous?.key !== key) return previous;
          let changed = 0;
          const readAt = new Date().toISOString();
          const rows = previous.rows.map(row => {
            if (row.read_at || (ids !== null && !ids.includes(row.id))) return row;
            changed += 1;
            return { ...row, read_at: readAt };
          });
          return { ...previous, rows, count: ids === null ? 0 : Math.max(0, previous.count - changed) };
        });
        setAction({ owner, busy: false, message: ids === null ? "All notifications marked as read." : "Notification marked as read." });
      }
    } catch (error) {
      if (currentOwner.current === owner) setAction({ owner, busy: false, error: `${error.message} Refresh to check the saved read status before trying again.` });
    } finally {
      writing.current = false;
    }
  }, [owner, key, writeData]);
  const visible = owner && result?.key === key ? result : null;
  return {
    notifications: (visible?.rows || []).map(row => ({ ...row, unread: !row.read_at, text: row.message, when: new Date(row.created_at).toLocaleString() })),
    unreadNotificationCount: visible?.count ?? null,
    notificationsLoading: Boolean(owner) && !visible,
    notificationsError: visible?.error || "",
    notificationAction: owner && action?.owner === owner ? action : null,
    notificationsOffset: offset,
    setNotificationsOffset: value => { setPage({ owner, offset: value }); setAction(null); },
    refreshNotifications, markNotificationsRead,
  };
}
