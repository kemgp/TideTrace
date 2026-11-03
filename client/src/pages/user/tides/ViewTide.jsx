import React, { useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import useRemoteData from "../../../hooks/useRemoteData.js";
import RemoteState from "../../../components/RemoteState.jsx";
import TideLesson from "../../../components/TideLesson.jsx";
import TideCompletion from "../../../components/TideCompletion.jsx";
import LessonNav from "../../../components/LessonNav.jsx";
import SlidesViewer from "../../../components/SlidesViewer.jsx";
import ReadingProgress from "../../../components/ReadingProgress.jsx";
import Card from "../../../components/Card.jsx";
import { imageIds, parseLesson, splitChapters } from "../../../api/lessonFormat.js";

export default function ViewTide() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const result = useRemoteData(`tides/${encodeURIComponent(id)}`);
  const lesson = result.data;
  const published = lesson?.status === "published";
  const card = useRef(null);
  // Remember which lesson was completed, so the highlight never carries over to the next lesson page.
  const [completedId, setCompletedId] = useState("");
  const [slideProgress, setSlideProgress] = useState(0);
  const blocks = useMemo(() => parseLesson(lesson?.body), [lesson?.body]);
  // Chapters apply to text lessons only; a lesson with slides keeps its slides and a single text version.
  const chapters = lesson?.paged && !lesson?.slides_path ? splitChapters(blocks).length : 0;
  const chaptered = chapters >= 2;
  const requested = Number.parseInt(params.get("part") || "1", 10);
  const part = chaptered ? Math.min(Math.max(Number.isFinite(requested) ? requested : 1, 1), chapters) : 1;
  const lastChapter = !chaptered || part === chapters;
  const wanted = published && imageIds(blocks).length > 0;
  const pictures = useRemoteData(wanted ? `tides/${encodeURIComponent(id)}/images` : null, { collection: true });
  const images = useMemo(() => new Map((pictures.data || []).map((image) => [image.id, image])), [pictures.data]);
  const progress = chaptered ? part / chapters : lesson?.slides_path ? slideProgress : undefined;
  const onPart = (next) => setParams({ part: String(next) }, { replace: true });
  return <div className="wrap user-lesson" style={{ maxWidth: 800 }}>
    <Link className="btn ghost sm" to="/user/tides" style={{ marginBottom: 16 }}>← Back to Tides</Link>
    <RemoteState {...result} />
    {lesson && (published ? <>
      <ReadingProgress targetRef={card} value={progress} />
      <div ref={card}><Card><span className="lbl">Tides · Lesson</span>{lesson.slides_path
        ? <><h2 className="lesson-title">{lesson.title}</h2><SlidesViewer key={lesson.id} tideId={lesson.id} pages={lesson.slides_pages} onProgress={setSlideProgress} /><details className="lesson-text-version" open><summary>Text version</summary><TideLesson hideTitle title={lesson.title} body={lesson.body} images={images} /></details></>
        : <TideLesson title={lesson.title} body={lesson.body} images={images} paged={chaptered} part={part} onPart={onPart} />}
        {lastChapter && <TideCompletion tideId={lesson.id} onCompleted={() => setCompletedId(lesson.id)} />}</Card></div>
      <LessonNav key={lesson.id} tideId={lesson.id} completed={completedId === lesson.id} />
    </> : <p role="alert">This lesson is not available.</p>)}
  </div>;
}
