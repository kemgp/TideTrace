import React from "react";
import { Link, useParams } from "react-router-dom";
import { useApp } from "../../../context/AppContext.jsx";
import useRemoteData from "../../../hooks/useRemoteData.js";
import TraceDraftForm from "../../../components/TraceDraftForm.jsx";
import RemoteState from "../../../components/RemoteState.jsx";

export default function EditSubmission() {
  const { id } = useParams();
  const { profile } = useApp();
  const result = useRemoteData(`contributions/${encodeURIComponent(id)}`);
  const trace = result.data;
  const editable = ["draft", "revision_requested"].includes(trace?.status) && trace.author_id === profile.id && !trace.is_hidden && !trace.deleted_at && Number.isInteger(trace.version) && trace.version > 0;
  return <div className="wrap" style={{ maxWidth: 760 }}>
    <Link className="btn ghost sm" style={{ marginBottom: 14 }} to={`/user/contributions/${encodeURIComponent(id)}`}>← Back to contribution</Link>
    <RemoteState {...result} />
    {trace && (editable ? <TraceDraftForm key={`${profile.id}:${trace.id}:${trace.version}`} trace={trace} onReload={result.retry} /> : <p role="alert">This contribution is not an editable draft. Only your own available drafts or requested revisions can be edited here.</p>)}
  </div>;
}
