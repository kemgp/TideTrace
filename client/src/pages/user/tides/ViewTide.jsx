import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import useRemoteData from "../../../hooks/useRemoteData.js";
import RemoteState from "../../../components/RemoteState.jsx";
import TideLesson from "../../../components/TideLesson.jsx";
import TideCompletion from "../../../components/TideCompletion.jsx";
import LessonNav from "../../../components/LessonNav.jsx";
import SlidesViewer from "../../../components/SlidesViewer.jsx";
import ReadingProgress from "../../../components/ReadingProgress.jsx";
import Card from "../../../components/Card.jsx";
import PageHeader from "../../../components/PageHeader.jsx";
import { useApp } from "../../../context/AppContext.jsx";
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

  // Saved reading position for chaptered lessons: carry on where the member stopped, and keep saving as they move.
  const { writeData } = useApp();
  const stoppedRecord = useRemoteData(chaptered ? `tide-progress?tide_ids=${encodeURIComponent(id)}` : null, { collection: true });
  const finishedRecord = useRemoteData(chaptered ? `tide-completions?tide_ids=${encodeURIComponent(id)}` : null, { collection: true });
  const ready = chaptered && lesson?.id === id && Boolean(stoppedRecord.data) && Boolean(finishedRecord.data) && !stoppedRecord.error && !finishedRecord.error;
  const finished = (finishedRecord.data?.length > 0) || completedId === id;
  const stoppedAt = Number(stoppedRecord.data?.[0]?.part) || 0;
  const hasPart = params.has("part");
  const [resumedFrom, setResumedFrom] = useState(0);
  const resumedFor = useRef("");
  useEffect(() => {
    if (!ready || resumedFor.current === id) return;
    resumedFor.current = id;
    if (!hasPart && !finished && stoppedAt > 1 && stoppedAt <= chapters) {
      setResumedFrom(stoppedAt);
      setParams({ part: String(stoppedAt) }, { replace: true });
    }
  }, [ready, id]);
  const sent = useRef({ id: "", part: 0 });
  useEffect(() => {
    if (!ready || finished) return undefined;
    if (sent.current.id !== id) sent.current = { id, part: stoppedAt };
    // Wait for the resume redirect above instead of overwriting the saved chapter with chapter 1.
    if (!hasPart && stoppedAt > 1) return undefined;
    if (part === sent.current.part || (part === 1 && !sent.current.part)) return undefined;
    const timer = setTimeout(async () => {
      try {
        await writeData(`tides/${encodeURIComponent(id)}/progress`, { method: "PUT", body: { part, total: chapters } });
        sent.current = { id, part };
      } catch { /* Saving a reading position is a convenience, so a failure stays quiet. */ }
    }, 400);
    return () => clearTimeout(timer);
  }, [ready, finished, part, id, chapters]);
  if (!lesson || !published) return <div className="wrap user-lesson" style={{ maxWidth: 800 }}>
    <Link className="btn ghost sm" to="/user/tides" style={{ marginBottom: 16 }}>← Back to Tides</Link>
    <RemoteState {...result} />
    {lesson && <p role="alert">This lesson is not available.</p>}
  </div>;
  return <>
    <PageHeader as="h2" back={<Link className="page-hero__back" to="/user/tides">← Back to Tides</Link>} eyebrow="Tides · Lesson" title={lesson.title || "Untitled lesson"} subtitle={(typeof lesson.summary === "string" && lesson.summary.trim()) || undefined}>
      {chaptered && <div className="page-hero__chips"><span>{chapters} chapters</span></div>}
    </PageHeader>
    <div className="page-body user-lesson">
      <ReadingProgress targetRef={card} value={progress} />
      <div ref={card}><Card>{lesson.slides_path
        ? <><SlidesViewer key={lesson.id} tideId={lesson.id} pages={lesson.slides_pages} onProgress={setSlideProgress} /><details className="lesson-text-version" open><summary>Text version</summary><TideLesson hideTitle title={lesson.title} body={lesson.body} images={images} /></details></>
        : <>{resumedFrom > 0 && part === resumedFrom && <p className="chapter-resume" role="status">Continuing from chapter {resumedFrom}. <button type="button" className="btn ghost sm" onClick={() => { setResumedFrom(0); onPart(1); }}>Start from the beginning</button></p>}<TideLesson hideTitle title={lesson.title} body={lesson.body} images={images} paged={chaptered} part={part} onPart={onPart} /></>}
        {lastChapter && <TideCompletion tideId={lesson.id} onCompleted={() => setCompletedId(lesson.id)} />}</Card></div>
      <LessonNav key={lesson.id} tideId={lesson.id} completed={completedId === lesson.id} />
    </div>
  </>;
}
