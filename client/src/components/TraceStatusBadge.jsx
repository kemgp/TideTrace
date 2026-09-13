import React from "react";

const LABELS = {
  pending: "Pending review",
  approved: "Approved",
  revision: "Needs revision",
  rejected: "Rejected",
};

export default function TraceStatusBadge({ status }) {
  return <span className={`badge ${status}`}>{LABELS[status] || status}</span>;
}
