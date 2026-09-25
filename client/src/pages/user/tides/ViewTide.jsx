import React from "react";
import { Link, useParams } from "react-router-dom";
import useRemoteData from "../../../hooks/useRemoteData.js";
import RemoteState from "../../../components/RemoteState.jsx";
import TideLesson from "../../../components/TideLesson.jsx";
import Card from "../../../components/Card.jsx";

export default function ViewTide() {
  const { id } = useParams();
  const result = useRemoteData(`tides/${encodeURIComponent(id)}`);
  const lesson = result.data;
  return <div className="wrap" style={{ maxWidth: 800 }}>
    <Link className="btn ghost sm" to="/user/tides" style={{ marginBottom: 16 }}>← Back to Tides</Link>
    <RemoteState {...result} />
    {lesson && (lesson.status === "published" ? <Card><span className="lbl">Tides · Lesson</span><TideLesson title={lesson.title} body={lesson.body} /></Card> : <p role="alert">This lesson is not available.</p>)}
  </div>;
}
