import React from "react";

/**
 * Step 5 of the upload wizard — review the draft trace and confirm submission.
 */
export default function ReviewSubmission({ draft, onEdit, onSubmit, onDiscard }) {
  return (
    <div>
      <div className="card">
        <span className="lbl">Step 5 · Review submission</span>
        <div className="rrow">
          <span className="k">Category</span>
          <span className="v hint">{draft.category || "Not selected"}</span>
          <button className="edlink" onClick={() => onEdit(1)}>Edit</button>
        </div>
        <div className="rrow">
          <span className="k">Location</span>
          <span className="v hint">{draft.location || "Not set"}</span>
          <button className="edlink" onClick={() => onEdit(2)}>Edit</button>
        </div>
        <div className="rrow">
          <span className="k">Description</span>
          <span className="v hint">{draft.description || "Not written"}</span>
          <button className="edlink" onClick={() => onEdit(3)}>Edit</button>
        </div>
        <div className="rrow">
          <span className="k">Media</span>
          <span className="v hint">{draft.media.length ? draft.media.join(", ") : "None attached"}</span>
          <button className="edlink" onClick={() => onEdit(4)}>Edit</button>
        </div>
      </div>
      <div className="decision">
        <h3>Submit this trace?</h3>
        <p>Yes → added to My Contributions as <b>Pending review</b> · No → keep editing, nothing is published.</p>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <button className="btn clay" onClick={onSubmit}>Yes — submit trace</button>
          <button className="btn outline" onClick={onDiscard}>No — keep editing</button>
        </div>
      </div>
    </div>
  );
}
