import React from "react";

export default function ImageUploader({ media, onAdd, onRemove }) {
  return (
    <div>
      <div className="g2">
        <button type="button" className="ph" style={{ height: 80 }} onClick={() => onAdd("Photo")}>
          ＋ Photo
        </button>
        <button type="button" className="ph" style={{ height: 80 }} onClick={() => onAdd("Video")}>
          ＋ Video
        </button>
      </div>
      <button type="button" className="chip" style={{ marginTop: 12 }} onClick={() => onAdd("Voice story")}>
        🎙 Record a voice story
      </button>
      <div className="chiprow" style={{ marginTop: 12 }}>
        {media.map((item, i) => (
          <span key={i} className="traychip">
            {item}
            <button type="button" onClick={() => onRemove(i)}>✕</button>
          </span>
        ))}
      </div>
    </div>
  );
}
