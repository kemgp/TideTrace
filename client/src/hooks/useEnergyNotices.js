import { useEffect, useRef } from "react";
import { useApp } from "../context/AppContext.jsx";
import useToast from "./useToast.js";
import { notifyEnergyChanged } from "../api/energy.js";

// What a notification means for Tide Energy, or null when it has nothing to do with it.
// Approving a Trace writes "... You earned 20 Tide Energy." and an admin reversal writes "... reversed 20 Tide Energy ...".
export function energyNotice(row) {
  const text = String(row?.message || "");
  if (row?.type === "trace_review") {
    const earned = /You earned (\d+) Tide Energy/.exec(text);
    return earned ? { message: `You earned ${earned[1]} Tide Energy for a Trace.`, type: "success" } : null;
  }
  if (row?.type === "energy_reversal") {
    const reversed = /reversed (\d+) Tide Energy/.exec(text);
    return { message: reversed ? `An admin reversed ${reversed[1]} Tide Energy.` : "An admin reversed some Tide Energy.", type: "info" };
  }
  return null;
}

// Watches the member's notifications while signed in. The first list is the baseline and never toasts.
// Any later notification about energy refreshes the navbar balance and shows one toast.
export default function useEnergyNotices() {
  const { notifications, notificationsLoading, notificationsOffset, profile } = useApp();
  const toast = useToast();
  const seen = useRef({ owner: null, ids: new Set() });
  useEffect(() => {
    if (notificationsLoading || notificationsOffset !== 0 || !profile?.id) return;
    if (seen.current.owner !== profile.id) { seen.current = { owner: profile.id, ids: new Set(notifications.map((row) => row.id)) }; return; }
    let changed = false;
    notifications.forEach((row) => {
      if (seen.current.ids.has(row.id)) return;
      seen.current.ids.add(row.id);
      const notice = energyNotice(row);
      if (!notice) return;
      changed = true;
      toast[notice.type](notice.message);
    });
    if (changed) notifyEnergyChanged();
  }, [notifications, notificationsLoading, notificationsOffset, profile?.id, toast]);
}
