import React from "react";
import { useApp } from "../../../context/AppContext.jsx";
import TideCard from "../../../components/TideCard.jsx";

export default function Tides() {
  const { tides } = useApp();
  const inProgress = tides.filter((t) => t.progress > 0 && t.progress < 100);

  return (
    <div className="wrap">
      <div className="vhead">
        <span className="eyebrow">Tides</span>
        <h2>Learn the sea in your own language</h2>
        <p>Bite-sized, community-rooted lessons with local names alongside scientific ones.</p>
      </div>

      {inProgress.length > 0 && (
        <>
          <h3 className="sec-t">Continue learning</h3>
          <div className="g3">{inProgress.map((t) => <TideCard key={t.id} tide={t} />)}</div>
        </>
      )}

      <h3 className="sec-t">Learn a new topic</h3>
      <div className="g3">{tides.map((t) => <TideCard key={t.id} tide={t} />)}</div>
    </div>
  );
}
