import useDashboard from "../../hooks/useDashboard.js";
import DashboardStats from "../../components/DashboardStats.jsx";
import useRemoteData from "../../hooks/useRemoteData.js";
import RemoteState from "../../components/RemoteState.jsx";
import { displayTrace } from "../../api/data.js";
import React from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";
import TraceCard from "../../components/TraceCard.jsx";
import Card from "../../components/Card.jsx";
import UserShortcuts from "../../components/UserShortcuts.jsx";
import Button from "../../components/Button.jsx";

export default function Dashboard() {
  const { profile } = useApp();
  const navigate = useNavigate();

  const totals = useDashboard();
  const recentResult = useRemoteData("traces?limit=3&offset=0", {
    collection: true,
  });
  const recent = (recentResult.data || []).map(displayTrace);

  return (
    <div className="wrap">
      <div className="banner">
        <div>
          <b>Kumusta, {profile?.display_name} — your activity</b>
          <div className="s">
            Your saved contributions and learning, all time
          </div>
        </div>

        <svg
          width={34}
          height={34}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="1.8"
        >
          <path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
          <path d="M2 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
        </svg>
      </div>

      <DashboardStats
        result={totals}
        items={[
          ["traces", "Your Traces"],
          ["approved", "Approved"],
          ["pending", "In review"],
        ]}
      />

      <div className="g2" style={{ marginTop: 16 }}>
        <Button
          variant="clay"
          onClick={() => navigate("/user/traces/upload")}
        >
          ＋ Upload Trace
        </Button>

        <Button
          variant="outline"
          onClick={() => navigate("/user/traces")}
        >
          Explore Traces
        </Button>
      </div>

      <h3 className="sec-t">Continue learning</h3>

      <Card className="user-learning-callout">
        <div>
          <span className="lbl">Explore Tides</span>
          <p>
            Coastal lessons from your community. Open Tides to see your saved
            completions.
          </p>
        </div>

        <Button
          variant="blue"
          onClick={() => navigate("/user/tides")}
        >
          Browse lessons →
        </Button>
      </Card>

      <UserShortcuts />

      <h3 className="sec-t">Recent from the community</h3>

      <RemoteState compact {...recentResult} />

      {recentResult.data && !recent.length && (
        <p>No published Traces yet.</p>
      )}

      <div className="g3">
        {recent.map((t) => (
          <TraceCard
            key={t.id}
            trace={t}
            to={`/user/traces/${t.id}`}
          />
        ))}
      </div>
    </div>
  );
}