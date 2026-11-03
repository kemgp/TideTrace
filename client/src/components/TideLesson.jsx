import React from "react";
import { imageIds, parseLesson, splitChapters } from "../api/lessonFormat.js";
import ChapterReader from "./ChapterReader.jsx";
import LessonBody from "./LessonBody.jsx";
import "./Lesson.css";

// `paged` shows the lesson one chapter at a time (when it has at least two); `part` and `onPart` control which.
// `images` maps an image id to { url }, for images placed inside the text.
export default function TideLesson({ title, body, hideTitle = false, images, paged = false, part = 1, onPart }) {
  const chapters = paged ? splitChapters(parseLesson(body)) : [];
  return <article aria-label="Lesson content" className="lesson">
    {!hideTitle && <h2 className="lesson-title">{title || "Untitled lesson"}</h2>}
    {chapters.length >= 2 ? <ChapterReader chapters={chapters} part={part} onPart={onPart || (() => {})} images={images} /> : <LessonBody body={body} images={images} />}
  </article>;
}

// Number of chapters a lesson would have when shown in chapters, and the image ids its text uses.
export function lessonShape(body) {
  const blocks = parseLesson(body);
  return { chapters: splitChapters(blocks).length, imageIds: imageIds(blocks) };
}
