import React, { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Link, useLocation, useParams } from "react-router-dom";
import useRemoteData from "../hooks/useRemoteData.js";
import { displayTrace } from "../api/data.js";
import RemoteState from "./RemoteState.jsx";
import TraceStatusBadge from "./TraceStatusBadge.jsx";
import TraceLocationPrivacy from "./TraceLocationPrivacy.jsx";
import TraceMap from "./TraceMap.jsx";
import TracePhotos from "./TracePhotos.jsx";
import { useApp } from "../context/AppContext.jsx";
import TraceFeedback from "./TraceFeedback.jsx";
import Card from "./Card.jsx";
import ReportContent from "./ReportContent.jsx";
import { safeArchiveSearch } from "../api/archiveParams.js";
import { safeContributionSearch } from "../api/contributionParams.js";
import TraceNeighbors, { TraceStepper } from "./TraceNeighbors.jsx";
import RelatedTraces from "./RelatedTraces.jsx";
import TraceComments from "./TraceComments.jsx";
import AuthorAvatar from "./AuthorAvatar.jsx";
import DeleteTrace from "./DeleteTrace.jsx";
import RelativeTime from "./RelativeTime.jsx";
import { OpenInMaps } from "./TraceShareActions.jsx";
import TraceMenu from "./TraceMenu.jsx";
import { fullDate } from "../api/relativeTime.js";
import "./trace-detail.css";

export default function LiveTraceDetail({ contribution = false }) {
  const { id } = useParams();
  const locationState = useLocation().state;
  const archiveSearch = safeArchiveSearch(locationState?.archiveSearch);
  const listSearch = safeContributionSearch(locationState?.listSearch);
  const { profile } = useApp();
  const base = contribution ? "contributions" : "traces";
  const result = useRemoteData(`${base}/${encodeURIComponent(id)}`);
  // One request feeds both the buttons beside "Back" and the cards after the comments.
  const neighbors = useRemoteData(contribution ? null : `traces/${encodeURIComponent(id)}/neighbors`, { object: true });

  return <div className={contribution ? "wrap" : "wrap trace-detail"} style={contribution ? { maxWidth: 760 } : undefined}>
    <div className="trace-detail__topbar">
      <Link className="btn ghost sm" to={`/user/${base}${contribution ? listSearch : archiveSearch}`} state={{ restoreScroll: true }}>← Back to {contribution ? "My Contributions" : "Traces"}</Link>
      {!contribution && <TraceStepper neighbors={neighbors} archiveSearch={archiveSearch} />}
    </div>
    <RemoteState {...result} />
    {result.data && <TraceContent key={`${profile?.id}:${result.data.id}`} initialTrace={result.data} contribution={contribution} archiveSearch={archiveSearch} neighbors={neighbors} />}
  </div>;
}

function TraceContent({ initialTrace, contribution, archiveSearch, neighbors }) {
  const { profile } = useApp();
  const [current, setCurrent] = useState(initialTrace);
  const [fieldErrors, setFieldErrors] = useState({});
  const fieldError = (name) => fieldErrors[name] ? <p id={name === "photo" ? "trace-photo-validation" : undefined} role="alert" style={{ color: "var(--clay)" }}>{fieldErrors[name]}</p> : null;
  const [submissionLocked, setSubmissionLocked] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const operationLock = useRef(null);
  const trace = displayTrace(current);
  const mine = current.author_id === profile?.id;
  const editable = contribution && current.author_id === profile?.id && ["draft", "revision_requested"].includes(current.status) && !current.is_hidden && !current.deleted_at;
  const editLink = editable && !submissionLocked && <Link className="btn outline sm" to={`/user/contributions/${encodeURIComponent(trace.id)}/edit`}>{current.status === "revision_requested" ? "Edit requested revision" : "Edit draft"}</Link>;
  const map = !contribution && current.is_sensitive ? <p className="hint">Location withheld</p> : <TraceMap latitude={current.latitude} longitude={current.longitude} showCoordinates={Boolean(contribution)} />;
  const onDeleted = () => {
    // Clear the selected-photo navigation guard before the confirmed deletion redirects.
    flushSync(() => setCurrent((saved) => ({ ...saved, deleted_at: new Date().toISOString() })));
  };
  const deleteButton = <DeleteTrace trace={current} disabled={submissionLocked} onDeleted={onDeleted} />;
  if (!contribution) {
    const posted = current.published_at || current.created_at;
    return (
      <Card className="trace-detail__card trace-detail__card--public">
        <div className="trace-detail__layout">
          <div className="trace-detail__main">
            <TracePhotos trace={current} hero />
            <div className="trace-detail__headline">
              <div className="trace-detail__titlerow">
                <h2 className="trace-detail__title">{trace.title || "Untitled draft"}</h2>
                <TraceMenu canReport={!mine} canDelete={mine && !current.deleted_at} deleteDisabled={submissionLocked}
                  onReport={() => setReportOpen(true)} onDelete={() => setDeleteOpen(true)} />
              </div>
              <div className="trace-detail__meta">
                <div className="trace-detail__author"><AuthorAvatar authorId={trace.author_id} name={trace.author} url={trace.author_avatar_url} /><p className="hint"><span className="trace-detail__author-name">{trace.author}</span>{posted && <> · <RelativeTime value={posted} /></>}</p></div>
                {trace.status === "approved" ? <span className="badge approved">Approved · Published</span> : <TraceStatusBadge status={trace.status} />}
              </div>
              <div className="chiprow trace-detail__tags"><span className="chip on">{trace.category}</span><span className="chip"><span aria-hidden="true">📍 </span>{trace.location}</span></div>
              {mine
                ? <DeleteTrace trace={current} open={deleteOpen} onOpenChange={setDeleteOpen} onDeleted={onDeleted} />
                : <ReportContent targetId={current.id} type="trace" open={reportOpen} onOpenChange={setReportOpen} />}
            </div>
            <span className="lbl sr-only">Description</span>
            <p className="trace-detail__description">{trace.description || "No description supplied."}</p>
            <TraceComments traceId={current.id} />
            <TraceNeighbors neighbors={neighbors} archiveSearch={archiveSearch} />
          </div>
          <aside className="trace-detail__aside" aria-label="Trace details">
            <section className="trace-detail__panel trace-detail__panel--location">
              <h3 className="trace-detail__panel-title">Location</h3>
              {current.is_sensitive
                ? <p className="trace-detail__locked"><span aria-hidden="true">🔒 </span>Location withheld<small>Hidden to protect this site.</small></p>
                : <>
                  <TraceMap latitude={current.latitude} longitude={current.longitude} showCoordinates={false} />
                  <OpenInMaps latitude={current.latitude} longitude={current.longitude} />
                </>}
            </section>
            <section className="trace-detail__panel trace-detail__panel--facts">
              <h3 className="trace-detail__panel-title">About this trace</h3>
              <dl className="trace-detail__facts">
                <div><dt>Category</dt><dd>{trace.category}</dd></div>
                {posted && <div><dt>Posted</dt><dd>{fullDate(posted)}</dd></div>}
                {trace.trace_media?.length > 0 && <div><dt>Photos</dt><dd>{trace.trace_media.length}</dd></div>}
              </dl>
            </section>
          </aside>
        </div>
        <RelatedTraces key={current.id} traceId={current.id} category={trace.category} archiveSearch={archiveSearch} />
      </Card>
    );
  }
  return (
    <Card className={contribution ? "" : "trace-detail__card"}>
      <div className="row between trace-detail__status">
        <div className="trace-detail__status-main">{!contribution && trace.status === "approved" ? <span className="badge approved">Approved · Published</span> : <TraceStatusBadge status={trace.status} />}{contribution && <span className="hint">{trace.when}</span>}</div>
        <div className="trace-detail__actions">
          {editLink}
          {deleteButton}
        </div>
      </div>
      {!contribution && <TracePhotos trace={current} hero />}
      <h2 className="trace-detail__title">{trace.title || "Untitled draft"}</h2>
      {fieldError("title")}
      <div className="chiprow trace-detail__tags"><span className="chip on">{trace.category}</span><span className="chip">{!contribution && <span aria-hidden="true">📍 </span>}{trace.location}</span></div>
      {fieldError("category_id")}
      {fieldError("location_name")}
      {contribution && map}
      {contribution && !current.deleted_at && <TraceLocationPrivacy trace={current} onChange={setCurrent} disabled={submissionLocked} />}
      <div className="trace-detail__author"><AuthorAvatar authorId={trace.author_id} name={trace.author} url={trace.author_avatar_url} /><p className="hint"><span className="trace-detail__author-name">{trace.author}</span>{!contribution && trace.when && <> · {trace.when}</>}</p></div>
      <div className="divider" />
      <span className={contribution ? "lbl" : "lbl sr-only"}>Description</span>
      <p className="trace-detail__description">{trace.description || "No description supplied."}</p>
      {fieldError("description")}
      {!contribution && map}
      {!contribution && !mine && <ReportContent targetId={current.id} type="trace" />}
      {!contribution && <TraceComments traceId={current.id} />}
      {contribution && trace.status === "pending" && <p role="status">Pending review. Your Trace is awaiting a reviewer; editing and uploads are disabled until a revision is requested.</p>}
      {contribution && current.status !== "draft" && <TraceFeedback key={`${current.id}:${current.status}`} id={current.id} />}
      {current.status === "revision_requested" && contribution && <p className="hint">Address the moderator's feedback, save your changes, then resubmit this Trace for review.</p>}
      {fieldError("photo")}
      {contribution && <TracePhotos trace={current} contribution onChange={setCurrent} onLockedChange={setSubmissionLocked} onValidation={setFieldErrors} operationLock={operationLock} />}
    </Card>
  );
}
