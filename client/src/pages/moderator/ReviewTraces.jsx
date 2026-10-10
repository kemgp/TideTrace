import { PAGE_SIZE } from "../../api/pagination.js";
import React,{useEffect,useRef,useState} from "react";
import {Link,useParams} from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";
import { ApiError } from "../../api/auth.js";
import { displayTrace } from "../../api/data.js";
import useRemoteData from "../../hooks/useRemoteData.js";
import RemoteState, { Pagination } from "../../components/RemoteState.jsx";
import TraceStatusBadge from "../../components/TraceStatusBadge.jsx";
import TraceFeedback from "../../components/TraceFeedback.jsx";
import TraceMap from "../../components/TraceMap.jsx";
import TracePhotos from "../../components/TracePhotos.jsx";
import {PHOTO_TYPES} from "../../api/photos.js";
import { categoryLabel } from "./TraceMarker.jsx";
const labels={approved: "Approved", revision_requested: "Needs revision", rejected: "Rejected" };
const reviewBase=(role)=> role === "admin" ? "/admin/review" : "/moderator/review";
function TraceQueuePhoto({trace,className,emptyClassName}){
  const {readData}=useApp();
  const [url,setUrl]=useState("");
  const [empty,setEmpty]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    setUrl("");
    setEmpty(false);
    const load=async()=>{
      try{
        let media=Array.isArray(trace?.trace_media)?trace.trace_media:[];
        if(!media.length){
          const detail=await readData(`moderation/traces/${encodeURIComponent(trace.id)}`,{signal:controller.signal});
          media=Array.isArray(detail?.trace_media)?detail.trace_media:[];
        }
        const photo=media
          .filter((item)=>PHOTO_TYPES.includes(item.mime_type))
          .sort((a,b)=>(a.sort_order??0)-(b.sort_order??0))[0];
        if(!photo?.id){
          if(!controller.signal.aborted)setEmpty(true);
          return;
        }
        const data=await readData(`media/${encodeURIComponent(photo.id)}/url`,{signal:controller.signal});
        if(!data?.url){
          if(!controller.signal.aborted)setEmpty(true);
          return;
        }
        if(!controller.signal.aborted)setUrl(data.url);
      }catch(error){
        if(!controller.signal.aborted)setEmpty(true);
      }
    };
    load();
    return()=>controller.abort();
  },[trace,readData]);
  if(url){
    return(
      <img
        className={className}
        src={url}
        alt={trace?.title?`${trace.title} submission`:"Trace submission"}
        referrerPolicy="no-referrer"
        onError={()=>{setUrl("");setEmpty(true);}}
      />
    );
  }
  return <span className={emptyClassName}>{empty?"No photo attached":"Loading photo…"}</span>;
}
export default function ReviewTraces(){
  const { id } = useParams();
  const { profile, role } = useApp();
  const base = reviewBase(role);
  return <div className="wrap" style={id ? { maxWidth: 760 } : undefined}>
    {(id || role === "admin") && <div className="row" style={{ marginBottom: 16 }}>
      {id && <Link className="btn ghost sm" to={base}>← Back to queue</Link>}
      {role === "admin" && <Link className="btn outline sm" to={`${base}/history`}>Moderation history</Link>}
    </div>}
    {id ? <ReviewDetail key={`${profile.id}:${id}`} id={id} /> : <ReviewQueue key={profile.id} base={base} />}
  </div>;
}
function ReviewQueue({base}){
  const [offset, setOffset] = useState(0);
  const [category, setCategory] = useState("All");
  const { role } = useApp();
  const result = useRemoteData(`moderation/traces?status=pending&limit=${PAGE_SIZE}&offset=${offset}`, { collection: true });
  const traces = (result.data || []).map((item) => ({ ...item, ...displayTrace(item) }));
  const categories = [...new Set(["Coral", "Oral history", "Pollution", "Fisheries", "Seagrass", "Other", ...traces.map((trace) => categoryLabel(trace.category))])];
  const filtered = role === "mod" && category !== "All" ? traces.filter((trace) => categoryLabel(trace.category) === category) : traces;
  return <>
    <div className="vhead"><span className="eyebrow teale">Review Traces</span><h2>Pending submissions</h2><p>Review the saved details and photos before approving, requesting changes, or rejecting a Trace.</p></div>
    {role === "mod" && <div className="mod-queue-filters"><div className="chiprow" aria-label="Filter traces by category">{["All", ...categories].map((label) => <button type="button" key={label} className={`chip ${category === label ? "on" : ""}`} aria-pressed={category === label} onClick={() => setCategory(label)}>{label}</button>)}</div><p className="hint">Categories filter the current page of pending submissions.</p></div>}
    <button className="btn outline sm" disabled={result.loading} onClick={result.retry}>Refresh queue</button>
    <RemoteState {...result} />
    {!result.loading && !result.error && (filtered.length ? (
      role === "mod" ? (
        <>
          <style>{`
            .mod-review-card-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:16px}
            .mod-review-card{border:1px solid #cfe0f4;border-radius:14px;background:#fff;overflow:hidden;min-width:0;display:flex;flex-direction:column}
            .mod-review-card-photo{margin:12px 12px 0;height:220px;border-radius:10px;background:#edf6fc;overflow:hidden;display:flex;align-items:center;justify-content:center}
            .mod-review-card-image{width:100%;height:100%;object-fit:contain;display:block}
            .mod-review-card-photo-empty{color:#6d84a7;font-size:13px}
            .mod-review-card-body{padding:14px 16px 16px;display:flex;flex-direction:column;gap:9px;flex:1}
            .mod-review-card-title{margin:0;color:#12326b;font-size:18px;font-weight:800}
            .mod-review-card-meta{margin:0;color:#6d84a7;font-size:13px}
            .mod-review-card-tags{display:flex;flex-wrap:wrap;gap:8px}
            .mod-review-card-tag{display:inline-flex;align-items:center;min-height:30px;padding:0 12px;border:1px solid #c8dcf4;border-radius:999px;color:#637da7;font-size:12px;background:#fff}
            .mod-review-card-footer{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:12px}
            .mod-review-card-date{color:#6d84a7;font-size:12px}
            .mod-review-card-link{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:9px 16px;border-radius:10px;background:#f8ead7;color:#975a12;font-size:13px;font-weight:700;text-decoration:none;white-space:nowrap}
            .mod-review-card-link:hover{background:#f3dfc4}
            html.dark-mode .mod-review-card{background:#172235;border-color:#34445d}
            html.dark-mode .mod-review-card-photo{background:#101827}
            html.dark-mode .mod-review-card-title{color:#e7eef7}
            html.dark-mode .mod-review-card-meta,html.dark-mode .mod-review-card-date{color:#9eafc6}
            html.dark-mode .mod-review-card-tag{background:#172235;border-color:#34445d;color:#b7c4d7}
            @media(max-width:900px){.mod-review-card-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
            @media(max-width:640px){.mod-review-card-grid{grid-template-columns:1fr}.mod-review-card-photo{height:240px}}
          `}</style>
          <div className="mod-review-card-grid">
            {filtered.map((trace) => {
              return (
                <article className="mod-review-card" key={trace.id}>
                  <div className="mod-review-card-photo">
                    <TraceQueuePhoto
                      trace={trace}
                      className="mod-review-card-image"
                      emptyClassName="mod-review-card-photo-empty"
                    />
                  </div>
                  <div className="mod-review-card-body">
                    <h3 className="mod-review-card-title">{trace.title}</h3>
                    <p className="mod-review-card-meta">Submitted by {trace.author}</p>
                    <div className="mod-review-card-tags">
                      {trace.category && <span className="mod-review-card-tag">{trace.category}</span>}
                      {trace.location && <span className="mod-review-card-tag">{trace.location}</span>}
                    </div>
                    <div className="mod-review-card-footer">
                      <span className="mod-review-card-date">{trace.when || ""}</span>
                      <Link className="mod-review-card-link" to={`${base}/${encodeURIComponent(trace.id)}`}>
                        Review <span aria-hidden="true">›</span>
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <div className="card admin-review-list">
          {filtered.map((trace) => (
            <Link className="lrow click" key={trace.id} to={`${base}/${encodeURIComponent(trace.id)}`} style={{ color: "inherit", textDecoration: "none" }}>
              <div className="grow">
                <div className="t">{trace.title}</div>
                <div className="m">{trace.author} · {trace.category} · {trace.location}{trace.when && ` · ${trace.when}`}</div>
              </div>
              <TraceStatusBadge status={trace.status} />
            </Link>
          ))}
        </div>
      )
    ) : <p className="hint">No pending submissions on this page.</p>)}
    <Pagination offset={offset} count={traces.length} size={PAGE_SIZE} onChange={setOffset} loading={result.loading} />
  </>;
}
function ReviewDetail({id}){
  const result = useRemoteData(`moderation/traces/${encodeURIComponent(id)}`);
  return <><RemoteState {...result} />{result.data && <Decision key={`${result.data.id}:${result.data.version}`} initialTrace={result.data} onReload={result.retry} />}</>;
}
function Decision({initialTrace,onReload}){
  const { profile, writeData, role } = useApp();
  const [current, setCurrent] = useState(initialTrace);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);
  const trace = displayTrace(current);
  const own = current.author_id === profile.id;
  const eligible = current.status === "pending" && !current.is_hidden && !current.deleted_at && !own && Number.isInteger(current.version) && current.version > 0;
  const decide = async (decision) => {
    if (request.current || blocked || !eligible) return;
    if (decision !== "approved" && !reason.trim()) { setError("Enter feedback before requesting revision or rejecting a Trace."); return; }
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    try {
      // Use the version actually reviewed, never silently upgrade to another reviewer's changes.
      const saved = await writeData(`moderation/traces/${encodeURIComponent(current.id)}/decision`, {
        method: "POST", body: { version: current.version, decision, reason: reason.trim() }, signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (saved?.id !== current.id || saved.status !== decision || !Number.isInteger(saved.version) || saved.version <= current.version) throw new ApiError("Decision response could not be verified.", "INVALID_RESPONSE");
      setCurrent({ ...current, ...saved });
      setNotice(`Decision saved: ${labels[decision]}. The pending queue and moderation history will show the saved result when opened.`);
    } catch (failure) {
      if (controller.signal.aborted || failure.code === "CANCELLED") return;
      if (failure.status === 409) {
        setBlocked(true);
        setError("This Trace changed after you opened it. Copy any feedback you want to keep, then reload the Trace and review it again.");
      } else if (failure.code === "NETWORK_ERROR" || failure.code === "INVALID_RESPONSE" || failure.status >= 500) {
        setBlocked(true);
        setError("We could not confirm the decision. Reload the Trace to check its status before trying again.");
      } else {
        if ([400, 403, 404].includes(failure.status)) setBlocked(true);
        setError(failure.message);
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      request.current = null;
    }
  };
  return <div className="card mod-review-detail">
    <TraceStatusBadge status={trace.status} />
    {role === "mod" && <div className="mod-review-media"><TracePhotos trace={current} /></div>}
    <h2 style={{ marginTop: 16 }}>{trace.title}</h2>
    <p className="hint">Submitted by {trace.author}</p>
    <div className="chiprow"><span className="chip">{trace.category}</span><span className="chip">{trace.location}</span></div>
    <TraceMap latitude={current.latitude} longitude={current.longitude} />
    <h3>Description</h3><p style={{ whiteSpace: "pre-wrap" }}>{trace.description}</p>
    {role !== "mod" && <TracePhotos trace={current} />}
    <TraceFeedback key={`${current.id}:${current.version}`} id={current.id} staff />
    {own && <p role="alert">You cannot review your own submission.</p>}
    {!own && !eligible && <p className="hint">This Trace is not awaiting a decision.</p>}
    {eligible && <section className="mod-decision" style={{ marginTop: 24 }}>
      <h3>Review decision</h3>
      <p className="hint">Approval publishes the Trace in the community archive. Revision requests ask the author for changes. Rejection is final and preserves the record in the author's contributions.</p>
      <label className="lbl" htmlFor="review-reason">Feedback (required for revision or rejection)</label>
      <textarea id="review-reason" className="input" rows={4} maxLength={2000} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} />
      <div className="row" style={{ marginTop: 16, flexWrap: "wrap" }}>
        <button className="btn teal" disabled={busy || blocked} onClick={() => decide("approved")}>Approve &amp; publish</button>
        <button className="btn clay" disabled={busy || blocked} onClick={() => decide("revision_requested")}>Request revision</button>
        <button className="btn outline" disabled={busy || blocked} onClick={() => decide("rejected")}>Reject</button>
      </div>
    </section>}
    {busy && <p role="status">Saving decision…</p>}
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert">{error}</p>}
    {blocked && <button className="btn outline" disabled={busy} onClick={onReload}>Reload Trace</button>}
  </div>;
}
export function ModerationHistory(){
  const { role } = useApp();
  const base = reviewBase(role);
  const [offset, setOffset] = useState(0);
  const result = useRemoteData(`moderation/history?limit=${PAGE_SIZE}&offset=${offset}`, { collection: true });
  const rows = result.data || [];
  return <div className="wrap">
    <Link className="btn ghost sm" to={base}>← Back to queue</Link>
    <div className="vhead"><h2>Moderation history</h2><p>Saved decisions and report resolutions, newest first.</p></div>
    <button className="btn outline sm" disabled={result.loading} onClick={result.retry}>Refresh history</button>
    <RemoteState {...result} />
    {!result.loading && !result.error && (rows.length ? <div className="card">{rows.map((row) => <div className="lrow" key={row.id}>
      <div className="grow">
        <div className="t">{row.trace_id && row.action === "review_trace" ? <Link to={`${base}/${encodeURIComponent(row.trace_id)}`}>{row.trace?.title || "View reviewed Trace"}</Link> : row.trace?.title || row.report?.trace?.title || (row.comment || row.report?.comment ? "Reported comment" : "Reported content")}</div>
        <p>{row.action === "review_trace" ? labels[row.to_state] || row.to_state : row.action === "review_report" ? (row.to_state === "resolved" ? "Report resolved — content removed" : "Report dismissed") : row.action.replaceAll("_", " ")}</p>
        <p className="hint">{row.actor?.display_name || "Staff member"} · {new Date(row.created_at).toLocaleString()}</p>
        {row.reason && <p style={{ whiteSpace: "pre-wrap" }}>{row.reason}</p>}
      </div>
    </div>)}</div> : <p className="hint">No moderation history on this page.</p>)}
    <Pagination offset={offset} count={rows.length} size={PAGE_SIZE} onChange={setOffset} loading={result.loading} />
  </div>;
}
