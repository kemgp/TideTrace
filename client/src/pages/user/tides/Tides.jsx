import React, { useState } from "react";
import useRemoteData from "../../../hooks/useRemoteData.js";
import RemoteState, { Pagination } from "../../../components/RemoteState.jsx";
import TideCard from "../../../components/TideCard.jsx";

export default function Tides() {
  const [offset, setOffset] = useState(0);
  const result = useRemoteData(`tides?limit=25&offset=${offset}`, { collection: true });
  const lessons = result.data || [];
  return <div className="wrap">
    <div className="vhead"><span className="eyebrow">Tides</span><h2>Learn about our coast</h2><p>Explore published lessons from your community.</p></div>
    <RemoteState {...result} />
    {!result.loading && !result.error && (lessons.length ? <div className="g3">{lessons.map((tide) => <TideCard key={tide.id} tide={tide} />)}</div> : <p>No published lessons found.</p>)}
    <Pagination offset={offset} count={lessons.length} size={25} onChange={setOffset} loading={result.loading || Boolean(result.error)} />
  </div>;
}
