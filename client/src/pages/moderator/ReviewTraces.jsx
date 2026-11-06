import { PAGE_SIZE } from "../../api/pagination.js";
import React,{useEffect,useRef,useState} from "react";
import {Link,useNavigate,useParams} from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";
import { ApiError } from "../../api/auth.js";
import { displayTrace } from "../../api/data.js";
import useRemoteData from "../../hooks/useRemoteData.js";
import RemoteState, { Pagination } from "../../components/RemoteState.jsx";
import AuthorAvatar from "../../components/AuthorAvatar.jsx";
import "../../components/trace-detail.css";
import PageHeader from "../../components/PageHeader.jsx";
import TraceCard from "../../components/TraceCard.jsx";
import TraceStatusBadge from "../../components/TraceStatusBadge.jsx";
import TraceFeedback from "../../components/TraceFeedback.jsx";
import TraceLocationPrivacy from "../../components/TraceLocationPrivacy.jsx";
import TraceMap from "../../components/TraceMap.jsx";
import TracePhotos from "../../components/TracePhotos.jsx";
import {PHOTO_TYPES} from "../../api/photos.js";
import { categoryLabel } from "./TraceMarker.jsx";
import { AuthorCard, QueueBadges, ConfirmDialog, REVIEW_REASONS, ReasonPicker, shortcutBlocked, useReasonTemplates, waitLabel, waitTone } from "./modTools.jsx";
const labels={approved: "Approved", revision_requested: "Needs revision", rejected: "Rejected" };
// What a saved decision means for the Trace, shown under the outcome banner.
const outcomes={approved:"It now appears in the community archive.",revision_requested:"It goes back to the author for changes.",rejected:"It will not be published."};
const reviewBase=(role)=> role === "admin" ? "/admin/review" : "/moderator/review";
function TraceQueuePhoto({trace,className,emptyClassName}){
  const {readData,profile}=useApp();
  const [url,setUrl]=useState("");
  const [empty,setEmpty]=useState(false);
  useEffect(()=>{
    if(profile?.data_saver)return;
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
  },[trace,readData,profile?.data_saver]);
  if(profile?.data_saver)return <span className={emptyClassName}>Open Trace to load photos</span>;
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
  if (role === "mod") return <ModWorkspace key={profile.id} id={id} base={base} />;
  if (!id) {
    const actions = role === "admin" ? <Link className="btn banner-secondary" to={`${base}/history`}>Moderation history</Link> : role === "mod" ? <Link className="btn banner-secondary" to={`${base}/history`}>My decisions</Link> : null;
    return <>
      <PageHeader eyebrow="Review Traces" title="Pending submissions" subtitle="Review the saved details and photos before approving, requesting changes, or rejecting a Trace." actions={actions} />
      <div className="page-body mod-queue-page"><ReviewQueue key={profile.id} base={base} /></div>
    </>;
  }
  return <div className="wrap" style={{ maxWidth: 760 }}>
    <div className="row" style={{ marginBottom: 16 }}>
      <Link className="btn ghost sm" to={base}>← Back to queue</Link>
      {role === "admin" && <Link className="btn outline sm" to={`${base}/history`}>Moderation history</Link>}
    </div>
    <ReviewDetail key={`${profile.id}:${id}`} id={id} />
  </div>;
}
// Moderators review in two panes: the queue (as Trace cards) on the left and the selected Trace on the right.
function ModWorkspace({id,base}){
  const navigate=useNavigate();
  const [offset,setOffset]=useState(0);
  const [filter,setFilter]=useState("all");
  const result=useRemoteData(`moderation/traces?status=pending&limit=${PAGE_SIZE}&offset=${offset}`,{collection:true,keepPrevious:true});
  const traces=(result.data||[]).map((item)=>({...item,...displayTrace(item)}));
  const flagged=traces.filter((trace)=>trace.report_count>0);
  const categories=[...new Set(traces.map((trace)=>categoryLabel(trace.category)))];
  const visible=filter==="all"?traces:filter==="flagged"?flagged:traces.filter((trace)=>categoryLabel(trace.category)===filter);
  const first=visible[0]?.id;
  useEffect(()=>{ if(!id&&first&&!result.loading) navigate(`${base}/${encodeURIComponent(first)}`,{replace:true}); },[id,first,result.loading,navigate,base]);
  const move=(step)=>{
    const index=visible.findIndex((trace)=>trace.id===id);
    const target=visible[index<0?0:Math.min(visible.length-1,Math.max(0,index+step))];
    if(target&&target.id!==id) navigate(`${base}/${encodeURIComponent(target.id)}`);
  };
  useEffect(()=>{
    const onKey=(event)=>{
      if(shortcutBlocked(event))return;
      const key=event.key.toLowerCase();
      if(key==="j"){event.preventDefault();move(1);}
      else if(key==="k"){event.preventDefault();move(-1);}
    };
    document.addEventListener("keydown",onKey);
    return()=>document.removeEventListener("keydown",onKey);
  });
  const chips=[["all",`All (${traces.length})`],["flagged",`Flagged (${flagged.length})`],...categories.map((label)=>[label,label])];
  return <>
    <PageHeader eyebrow="Review traces" title="Pending submissions" subtitle="Flagged first, then longest waiting. After you decide, the next trace opens on its own." actions={<Link className="btn banner-secondary" to={`${base}/history`}>My decisions</Link>} />
    <div className="page-body mod-workspace">
      <aside className="card mod-queue-pane" aria-label="Pending queue">
        <div className="chiprow" role="group" aria-label="Filter traces">{chips.map(([value,label])=><button type="button" key={value} className={`chip ${filter===value?"on":""}`} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}</div>
        <button className="btn outline sm" disabled={result.loading} onClick={result.retry}>Refresh queue</button>
        <RemoteState {...result} />
        {!result.loading&&!result.error&&(visible.length?<div className="mod-queue-list mod-cards">{visible.map((trace,index)=><TraceCard key={trace.id} trace={trace} priority={index<2} selected={trace.id===id} to={`${base}/${encodeURIComponent(trace.id)}`} detailPath="moderation/traces" badges={<QueueBadges trace={trace} />} />)}</div>:<p className="hint">No pending submissions on this page.</p>)}
        <p className="hint mod-keys">Move with <kbd>J</kbd> <kbd>K</kbd></p>
        <Pagination offset={offset} count={traces.length} size={PAGE_SIZE} onChange={setOffset} loading={result.loading} />
      </aside>
      <section className="mod-detail-pane" aria-label="Selected Trace">
        {id?<ReviewDetail key={id} id={id} onDecided={result.retry} />:<p className="hint">Choose a Trace from the queue.</p>}
      </section>
    </div>
  </>;
}
function ReviewQueue({base}){
  const [offset, setOffset] = useState(0);
  const [category, setCategory] = useState("All");
  const [hold, setHold] = useState("all");
  const { role } = useApp();
  const holdQuery = role === "admin" && hold !== "all" ? `&hold=${hold}` : "";
  const result = useRemoteData(`moderation/traces?status=pending&limit=${PAGE_SIZE}&offset=${offset}${holdQuery}`, { collection: true });
  const traces = (result.data || []).map((item) => ({ ...item, ...displayTrace(item) }));
  const categories = [...new Set(["Coral", "Oral history", "Pollution", "Fisheries", "Seagrass", "Other", ...traces.map((trace) => categoryLabel(trace.category))])];
  const filtered = role === "mod" && category !== "All" ? traces.filter((trace) => categoryLabel(trace.category) === category) : traces;
  return <>
    {role === "mod" && <div className="mod-queue-filters"><div className="chiprow" aria-label="Filter traces by category">{["All", ...categories].map((label) => <button type="button" key={label} className={`chip ${category === label ? "on" : ""}`} aria-pressed={category === label} onClick={() => setCategory(label)}>{label}</button>)}</div><p className="hint">Categories filter the current page of pending submissions.</p></div>}
    {role === "admin" && <div className="chiprow" role="group" aria-label="Filter by hold">{[["all", "All pending"], ["only", "On hold"], ["exclude", "Not on hold"]].map(([value, label]) => <button type="button" key={value} className={`chip ${hold === value ? "on" : ""}`} aria-pressed={hold === value} onClick={() => { setHold(value); setOffset(0); }}>{label}</button>)}</div>}
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
                      <span className="mod-review-card-date">{trace.when || ""}{trace.submitted_at && <span className={`wait-chip ${waitTone(trace.submitted_at)}`}>{waitLabel(trace.submitted_at)}</span>}</span>
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
                <div className="m">{trace.author} · {trace.category} · {trace.location}{trace.when && ` · ${trace.when}`}{trace.submitted_at && <span className={`wait-chip ${waitTone(trace.submitted_at)}`}>{waitLabel(trace.submitted_at)}</span>}</div>
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
function ReviewDetail({id,onDecided}){
  const result = useRemoteData(`moderation/traces/${encodeURIComponent(id)}`);
  return <><RemoteState {...result} />{result.data && <Decision key={`${result.data.id}:${result.data.version}`} initialTrace={result.data} onReload={result.retry} onDecided={onDecided} />}</>;
}
function Decision({initialTrace,onReload,onDecided}){
  const { profile, writeData, readData, role } = useApp();
  const navigate = useNavigate();
  const templates = useReasonTemplates("review");
  const reasonBox = useRef(null);
  const [confirming, setConfirming] = useState("");
  const [holding, setHolding] = useState(false);
  const [holdReason, setHoldReason] = useState("");
  const [reviews, setReviews] = useState([]);
  const [checks, setChecks] = useState({ photo: false, location: false, people: false });
  const [next, setNext] = useState(null);
  const [seconds, setSeconds] = useState(0);
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
  const held = Boolean(current.hold);
  const heldForAdmin = held && role !== "admin";
  const resubmitted = current.status === "pending" && reviews.some((review) => review.to_state === "revision_requested");
  const lastAsk = reviews.find((review) => review.to_state === "revision_requested");
  const allChecked = checks.photo && checks.location && checks.people;
  const preciseLocation = eligible && current.latitude != null && current.longitude != null && !current.is_sensitive;
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
      setCurrent({ ...current, ...saved, hold: null });
      setConfirming("");
      setNotice(decision);
      onDecided?.();
      readData("moderation/traces?status=pending&limit=1&offset=0", { signal: controller.signal }).then((rows) => {
        const upcoming = Array.isArray(rows) ? rows.find((row) => row.id && row.id !== current.id) : null;
        if (upcoming && !controller.signal.aborted) { setNext(upcoming); setSeconds(6); }
      }).catch(() => {});
    } catch (failure) {
      if (controller.signal.aborted || failure.code === "CANCELLED") return;
      setConfirming("");
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
  const hold = async () => {
    if (request.current || !holdReason.trim()) return;
    const controller = new AbortController();
    request.current = controller; setBusy(true); setError("");
    try {
      const saved = await writeData(`moderation/traces/${encodeURIComponent(current.id)}/hold`, { method: "POST", body: { version: current.version, reason: holdReason.trim() }, signal: controller.signal });
      if (controller.signal.aborted) return;
      if (saved?.id !== current.id || !Number.isInteger(saved.version) || saved.version <= current.version) throw new ApiError("Hold response could not be verified.", "INVALID_RESPONSE");
      setCurrent({ ...current, ...saved, hold: { reason: holdReason.trim(), holder: { display_name: profile.display_name } } });
      setHolding(false); setHoldReason("");
    } catch (failure) {
      if (controller.signal.aborted || failure.code === "CANCELLED") return;
      setHolding(false);
      setBlocked(true);
      setError(failure.status === 409 ? "This Trace changed after you opened it. Reload it and try again." : failure.message);
    } finally { if (!controller.signal.aborted) setBusy(false); request.current = null; }
  };
  const release = async () => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller; setBusy(true); setError("");
    try {
      const saved = await writeData(`moderation/traces/${encodeURIComponent(current.id)}/release-hold`, { method: "POST", signal: controller.signal });
      if (controller.signal.aborted) return;
      if (saved?.id !== current.id) throw new ApiError("Release response could not be verified.", "INVALID_RESPONSE");
      setCurrent({ ...current, ...saved, hold: null });
    } catch (failure) {
      if (controller.signal.aborted || failure.code === "CANCELLED") return;
      setBlocked(true); setError(failure.message);
    } finally { if (!controller.signal.aborted) setBusy(false); request.current = null; }
  };
  const ready = eligible && !busy && !blocked && !heldForAdmin && !notice;
  useEffect(() => {
    if (!ready) return undefined;
    const onKey = (event) => {
      if (shortcutBlocked(event)) return;
      const key = event.key.toLowerCase();
      if (key === "a") { event.preventDefault(); decide("approved"); }
      else if (key === "r") { event.preventDefault(); if (reason.trim()) decide("revision_requested"); else { reasonBox.current?.focus(); setError("Enter feedback before requesting revision or rejecting a Trace."); } }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });
  useEffect(() => {
    if (!next || seconds <= 0) return undefined;
    const timer = setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [next, seconds]);
  useEffect(() => { if (next && seconds === 0) navigate(`${reviewBase(role)}/${encodeURIComponent(next.id)}`); }, [next, seconds, navigate, role]);
  return <div className="mod-review-stack">
    {preciseLocation && <p className="mod-callout mod-callout--warn" role="note"><strong>Check the pin before approving.</strong> This Trace shows an exact location. If it points to a nesting site, a fishing spot or private land, hide the exact location above first.</p>}
    {held && <div className="mod-callout mod-callout--hold" role="status"><p><strong>On hold for an admin.</strong> {current.hold.reason}{current.hold.holder?.display_name ? ` (held by ${current.hold.holder.display_name})` : ""}</p>{role === "admin" && <button type="button" className="btn outline sm" disabled={busy} onClick={release}>Release hold</button>}</div>}
  <div className="card mod-review-detail mod-case">
    {current.deleted_at && <p className="hint">Deleted by the author.</p>}
    {!current.deleted_at && <div className="mod-case__photos trace-detail__card--public"><TracePhotos trace={current} hero /></div>}
    <div className="mod-case__body">
      <div className="mod-case__meta">
        <span className="mod-case__author"><AuthorAvatar authorId={current.author_id} name={trace.author} url={current.author?.avatar_url} /><b>{trace.author}</b>{current.submitted_at && <span> · submitted {new Date(current.submitted_at).toLocaleDateString()}</span>}</span>
        <span className="mod-case__status">{waitLabel(current.submitted_at) && trace.status === "pending" && <span className={`wait-chip ${waitTone(current.submitted_at)}`}>{waitLabel(current.submitted_at)}</span>}<TraceStatusBadge status={trace.status} /></span>
      </div>
      <div className="chiprow"><span className="chip">{trace.category}</span><span className="chip">{trace.location}</span>{resubmitted && <span className="chip chip--resubmitted">Resubmitted after changes</span>}</div>
      <h2>{trace.title}</h2>
      <p className="mod-case__description" style={{ whiteSpace: "pre-wrap" }}>{trace.description}</p>
      {resubmitted && lastAsk?.reason && <p className="mod-callout" role="note"><strong>Last request:</strong> {lastAsk.reason}</p>}
      <section className="mod-location" aria-label="Location">
        <h3>Location</h3>
        <TraceMap latitude={current.latitude} longitude={current.longitude} showCoordinates />
        {!current.deleted_at && <TraceLocationPrivacy trace={current} onChange={setCurrent} disabled={busy || blocked} />}
      </section>
      <TraceFeedback key={`${current.id}:${current.version}`} id={current.id} staff collapsible onReviews={setReviews} />
    </div>
  </div>
    {eligible && <AuthorCard authorId={current.author_id} name={trace.author} />}
  <div className="card mod-decision-card">
    {own && <p role="alert">You cannot review your own submission.</p>}
    {!own && !eligible && !notice && <p className="hint">This Trace is not awaiting a decision.</p>}
    {eligible && <section className="mod-decision" style={{ marginTop: 24 }}>
      <h3>Review decision</h3>
      <p className="hint">Approve publishes the Trace. Request revision returns it to the author. Reject is final.</p>
      <fieldset className="mod-checks" disabled={busy || heldForAdmin}>
        <legend className="lbl">Quick checks (optional)</legend>
        {[["photo", "Photo is clear"], ["location", "Location is okay"], ["people", "No one can be identified"]].map(([key, label]) => <label key={key} className="mod-check"><input type="checkbox" checked={checks[key]} onChange={(event) => setChecks({ ...checks, [key]: event.target.checked })} /> {label}</label>)}
        {allChecked && <span className="mod-checks__ready" role="status">All checks passed. Approve is ready.</span>}
      </fieldset>
      <label className="lbl" htmlFor="review-reason">Feedback (required for revision or rejection)</label>
      <textarea id="review-reason" ref={reasonBox} className="input" rows={4} maxLength={2000} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} />
      <ReasonPicker options={REVIEW_REASONS} templates={templates} value={reason} disabled={busy || heldForAdmin} onPick={(text) => { setReason(text); reasonBox.current?.focus(); }} />
      {heldForAdmin && <p className="hint">This Trace is on hold. Only an admin can decide it.</p>}
      <div className="row" style={{ marginTop: 16, flexWrap: "wrap" }}>
        <button className={`btn blue${allChecked ? " is-ready" : ""}`} aria-label="Approve & publish" disabled={busy || blocked || heldForAdmin} onClick={() => decide("approved")}>Approve &amp; publish <kbd aria-hidden="true">A</kbd></button>
        <button className="btn outline" aria-label="Request revision" disabled={busy || blocked || heldForAdmin} onClick={() => decide("revision_requested")}>Request revision <kbd aria-hidden="true">R</kbd></button>
        <button className="btn danger" disabled={busy || blocked || heldForAdmin} onClick={() => { if (!reason.trim()) { setError("Enter feedback before requesting revision or rejecting a Trace."); return; } setError(""); setConfirming("rejected"); }}>Reject</button>
        {!held && <button className="btn outline btn-dashed" disabled={busy || blocked} onClick={() => setHolding(true)}>Hold for admin</button>}
      </div>
      <p className="hint mod-keys">Shortcuts: <kbd>A</kbd> approve, <kbd>R</kbd> request revision, <kbd>J</kbd> <kbd>K</kbd> move through the queue.</p>
    </section>}
    {confirming === "rejected" && <ConfirmDialog title="Reject this Trace?" confirmLabel="Reject this Trace" busy={busy} onCancel={() => setConfirming("")} onConfirm={() => decide("rejected")}>
      <p>Rejecting is final. The author is told why and the Trace will not be published.</p>
      <p className="mod-dialog__quote">{reason.trim()}</p>
    </ConfirmDialog>}
    {holding && <ConfirmDialog title="Hold this Trace for an admin?" confirmLabel="Hold Trace" confirmClass="blue" busy={busy} disabled={!holdReason.trim()} onCancel={() => setHolding(false)} onConfirm={hold}>
      <p>The Trace leaves every other moderator's queue until an admin decides it. Say what you are unsure about.</p>
      <label className="lbl" htmlFor="hold-reason">Why does an admin need to look?</label>
      <textarea id="hold-reason" className="input" rows={3} maxLength={2000} value={holdReason} onChange={(event) => setHoldReason(event.target.value)} />
    </ConfirmDialog>}
    {busy && <p role="status">Saving…</p>}
    {notice && <div className={`decision-outcome is-${notice}`} role="status"><p><strong>Decision saved: {labels[notice]}.</strong> {outcomes[notice]}</p><Link className="btn outline sm" to={reviewBase(role)}>Review the queue</Link>{next && seconds > 0 && <span className="decision-next"> Opening the next Trace in {seconds}s. <button type="button" className="btn ghost sm" onClick={() => setNext(null)}>Stay here</button></span>}</div>}
    {error && <p role="alert">{error}</p>}
    {blocked && <button className="btn outline" disabled={busy} onClick={onReload}>Reload Trace</button>}
  </div>
  </div>;
}
export function ModerationHistory(){
  const { role } = useApp();
  const base = reviewBase(role);
  const [offset, setOffset] = useState(0);
  const mine = role === "mod";
  const result = useRemoteData(`moderation/history?limit=${PAGE_SIZE}&offset=${offset}${mine ? "&mine=true" : ""}`, { collection: true });
  const rows = result.data || [];
  return <div className="wrap">
    <Link className="btn ghost sm" to={base}>← Back to queue</Link>
    <div className="vhead"><h2>{mine ? "My decisions" : "Moderation history"}</h2><p>{mine ? "Decisions you saved on Traces and reports, newest first." : "Saved decisions and report resolutions, newest first."}</p></div>
    <button className="btn outline sm" disabled={result.loading} onClick={result.retry}>Refresh history</button>
    <RemoteState {...result} />
    {!result.loading && !result.error && (rows.length ? <div className="card">{rows.map((row) => <div className="lrow" key={row.id}>
      <div className="grow">
        <div className="t">{row.trace_id && row.action === "review_trace" ? <Link to={`${base}/${encodeURIComponent(row.trace_id)}`}>{row.trace?.title || "View reviewed Trace"}</Link> : row.trace?.title || row.report?.trace?.title || (row.comment || row.report?.comment ? "Reported comment" : "Reported content")}</div>
        {(row.trace?.deleted_at || row.report?.trace?.deleted_at) && <p className="hint">Deleted by the author.</p>}
        <p>{row.action === "review_trace" ? labels[row.to_state] || row.to_state : row.action === "review_report" ? (row.to_state === "resolved" ? "Report resolved: content removed" : "Report dismissed") : row.action.replaceAll("_", " ")}</p>
        <p className="hint">{row.actor?.display_name || "Staff member"} · {new Date(row.created_at).toLocaleString()}</p>
        {row.reason && <p style={{ whiteSpace: "pre-wrap" }}>{row.reason}</p>}
      </div>
    </div>)}</div> : <p className="hint">No moderation history on this page.</p>)}
    <Pagination offset={offset} count={rows.length} size={PAGE_SIZE} onChange={setOffset} loading={result.loading} />
  </div>;
}
