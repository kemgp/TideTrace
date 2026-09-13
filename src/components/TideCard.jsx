import React from "react";
import { useNavigate } from "react-router-dom";

export default function TideCard({ tide }) {
  const navigate = useNavigate();
  return (
    <div className="tcard" onClick={() => navigate(`/user/tides/${tide.id}`)}>
      <div className="thumb" style={{ background: "var(--teal)" }} />
      <div className="t">{tide.title}</div>
      <div className="m">
        <span>{tide.module} · {tide.duration}</span>
        <span className="hint">{tide.progress === 100 ? "Completed" : tide.progress > 0 ? `${tide.progress}%` : "Start"}</span>
      </div>
    </div>
  );
}
