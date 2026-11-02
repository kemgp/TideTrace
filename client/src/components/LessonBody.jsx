import React from "react";
import { inlineParts, parseLesson } from "../api/lessonFormat.js";

function Inline({ text }) {
  return inlineParts(text).map((part, index) => part.bold ? <strong key={index}>{part.text}</strong> : <React.Fragment key={index}>{part.text}</React.Fragment>);
}

// Renders lesson text with the structure parseLesson finds. Text goes through React, so nothing is treated as HTML.
export default function LessonBody({ body }) {
  const blocks = parseLesson(body);
  if (!blocks.length) return <p className="lesson-empty">No lesson content yet.</p>;
  return <div className="lesson-body">
    {blocks.map((block, index) => {
      if (block.type === "h3") return <h3 key={index}><Inline text={block.text} /></h3>;
      if (block.type === "h4") return <h4 key={index}><Inline text={block.text} /></h4>;
      if (block.type === "ul" || block.type === "ol") {
        const List = block.type;
        return <List key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}><Inline text={item} /></li>)}</List>;
      }
      return <p key={index}>{block.lines.map((line, lineIndex) => <React.Fragment key={lineIndex}>{lineIndex > 0 && <br />}<Inline text={line} /></React.Fragment>)}</p>;
    })}
  </div>;
}
