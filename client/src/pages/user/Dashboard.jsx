import React from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";
import TraceCard from "../../components/TraceCard.jsx";
import Card from "../../components/Card.jsx";
import Button from "../../components/Button.jsx";

export default function Dashboard() {
  const { profile, traces } = useApp();
  const navigate = useNavigate();

  const mine = traces.filter((t) => t.author === "Ana Ramos");
  const approved = mine.filter((t) => t.status === "approved").length;
  const review = mine.filter((t) => t.status === "pending").length;
  const recent = traces.slice(0, 3);

  return (
    <div className="wrap">
      <div className="banner">
        <div>
          <b>Kumusta, {profile?.display_name} — this month's impact</b>
          <div className="s">Brgy. Lawis and neighboring communities</div>
        </div>
        <svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8">
          <path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
          <path d="M2 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
        </svg>
      </div>

      <div className="g3" style={{ marginTop: 16 }}>
        <div className="stat"><b>{mine.length}</b><span>your traces</span></div>
        <div className="stat"><b>{approved}</b><span>approved</span></div>
        <div className="stat"><b>{review}</b><span>in review</span></div>
      </div>

      <div className="g2" style={{ marginTop: 16 }}>
        <Button variant="clay" onClick={() => navigate("/user/traces/upload")}>＋ Upload Trace</Button>
        <Button variant="outline" onClick={() => navigate("/user/traces")}>Explore Traces</Button>
      </div>

      <h3 className="sec-t">Go to</h3>
      <Card>
        <button className="shortcut" onClick={() => navigate("/user/traces")}>
          <span>🌊 Traces — explore the community archive</span><span>›</span>
        </button>
        <button className="shortcut" onClick={() => navigate("/user/tides")}>
          <span>📚 Tides — educational content</span><span>›</span>
        </button>
        <button className="shortcut" onClick={() => navigate("/user/contributions")}>
          <span>📋 My Contributions — track your traces</span><span>›</span>
        </button>
        <button className="shortcut" onClick={() => navigate("/user/notifications")}>
          <span>🔔 Notifications</span><span>›</span>
        </button>
        <button className="shortcut" onClick={() => navigate("/user/profile")}>
          <span>⚙️ Settings</span><span>›</span>
        </button>
      </Card>

      <h3 className="sec-t">Recent from the community</h3>
      <div className="g3">
        {recent.map((t) => <TraceCard key={t.id} trace={t} to={`/user/traces/${t.id}`} />)}
      </div>
    </div>
  );
}
