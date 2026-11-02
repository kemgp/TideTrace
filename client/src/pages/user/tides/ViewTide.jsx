import React, { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import useRemoteData from "../../../hooks/useRemoteData.js";
import RemoteState from "../../../components/RemoteState.jsx";
import TideLesson from "../../../components/TideLesson.jsx";
import TideCompletion from "../../../components/TideCompletion.jsx";
import LessonNav from "../../../components/LessonNav.jsx";
import SlidesViewer from "../../../components/SlidesViewer.jsx";
import ReadingProgress from "../../../components/ReadingProgress.jsx";
import Card from "../../../components/Card.jsx";

export default function ViewTide() {
  const { id } = useParams();
  const result = useRemoteData(`tides/${encodeURIComponent(id)}`);
  const lesson = result.data;
  const published = lesson?.status === "published";
  const card = useRef(null);
  // Remember which lesson was completed, so the highlight never carries over to the next lesson page.
  const [completedId, setCompletedId] = useState("");
  const [slideProgress, setSlideProgress] = useState(0);
  return <div className="wrap user-lesson" style={{ maxWidth: 800 }}>
    <Link className="btn ghost sm" to="/user/tides" style={{ marginBottom: 16 }}>← Back to Tides</Link>
    <RemoteState {...result} />
    {lesson && (published ? <>
      <ReadingProgress targetRef={card} value={lesson.slides_path ? slideProgress : undefined} />
      <div ref={card}><Card><span className="lbl">Tides · Lesson</span>{lesson.slides_path
        ? <><h2 className="lesson-title">{lesson.title}</h2><SlidesViewer key={lesson.id} tideId={lesson.id} pages={lesson.slides_pages} onProgress={setSlideProgress} /><details className="lesson-text-version" open><summary>Text version</summary><TideLesson hideTitle title={lesson.title} body={lesson.body} /></details></>
        : <TideLesson title={lesson.title} body={lesson.body} />}<TideCompletion tideId={lesson.id} onCompleted={() => setCompletedId(lesson.id)} /></Card></div>
      <LessonNav key={lesson.id} tideId={lesson.id} completed={completedId === lesson.id} />
    </> : <p role="alert">This lesson is not available.</p>)}
  </div>;
}
