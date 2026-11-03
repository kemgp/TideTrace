import React, { useState } from "react";
import { inlineParts, parseLesson } from "../api/lessonFormat.js";

function Inline({ text }) {
  return inlineParts(text).map((part, index) => part.bold ? <strong key={index}>{part.text}</strong> : <React.Fragment key={index}>{part.text}</React.Fragment>);
}

// An image inside the lesson text. If it has no link or fails to load, the description is shown instead.
function LessonImage({ alt, url }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <p className="lesson-image-missing">{alt ? `Image not available: ${alt}` : "Image not available."}</p>;
  return <figure className="lesson-figure"><img src={url} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} /></figure>;
}

// Renders lesson text with the structure parseLesson finds. Text goes through React, so nothing is treated as HTML.
// `blocks` can be passed instead of `body` (for one chapter); `images` maps an image id to { url }.
export default function LessonBody({ body, blocks: given, images }) {
  const blocks = given || parseLesson(body);
  if (!blocks.length) return <p className="lesson-empty">No lesson content yet.</p>;
  return <div className="lesson-body">
    {blocks.map((block, index) => {
      if (block.type === "h3") return <h3 key={index}><Inline text={block.text} /></h3>;
      if (block.type === "h4") return <h4 key={index}><Inline text={block.text} /></h4>;
      if (block.type === "image") return <LessonImage key={index} alt={block.alt} url={images?.get?.(block.id)?.url} />;
      if (block.type === "ul" || block.type === "ol") {
        const List = block.type;
        return <List key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}><Inline text={item} /></li>)}</List>;
      }
      return <p key={index}>{block.lines.map((line, lineIndex) => <React.Fragment key={lineIndex}>{lineIndex > 0 && <br />}<Inline text={line} /></React.Fragment>)}</p>;
    })}
  </div>;
}
