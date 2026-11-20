import React, { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import useRemoteData from "../hooks/useRemoteData.js";
import AdminIcon from "./AdminIcon.jsx";
import { ENERGY_CHANGED } from "../api/energy.js";
import useEnergyNotices from "../hooks/useEnergyNotices.js";
import "./energy.css";

// The balance in the navbar (members only, and only while Tide Energy is switched on).
// It reads the first page of the ledger just for the balance, and reads again after each page change so a new award shows up
// without a reload. A failed read hides the pill rather than showing a wrong number.
export default function EnergyPill() {
  const { pathname } = useLocation();
  useEnergyNotices();
  const result = useRemoteData("energy?limit=1&offset=0", { object: true, keepPrevious: true });
  const seen = useRef(pathname);
  const { retry } = result;
  useEffect(() => {
    if (seen.current === pathname) return;
    seen.current = pathname;
    retry();
  }, [pathname, retry]);
  useEffect(() => {
    window.addEventListener(ENERGY_CHANGED, retry);
    return () => window.removeEventListener(ENERGY_CHANGED, retry);
  }, [retry]);
  const balance = result.data?.balance;
  if (!Number.isFinite(balance)) return null;
  return <Link className="energy-pill" to="/user/energy" aria-label={`Tide Energy balance: ${balance}`}><AdminIcon name="bolt" size={16} />{balance}</Link>;
}
