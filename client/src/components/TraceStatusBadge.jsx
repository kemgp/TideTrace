import React from "react";

const LABELS = {
  draft: "Draft",
  pending: "Pending review",
  approved: "Approved",
  revision: "Needs revision",
  rejected: "Rejected",
  removed: "Removed",
};

export default function TraceStatusBadge({ status }) {
  return <span className={`badge ${status}`}>{LABELS[status] || status}</span>;
}
