import React from "react";
import { fullDate, relativeTime } from "../api/relativeTime.js";

export default function RelativeTime({ value, className = "" }) {
  const label = relativeTime(value);
  if (!label) return null;
  return <time className={className || undefined} dateTime={new Date(value).toISOString()} title={fullDate(value)}>{label}</time>;
}
