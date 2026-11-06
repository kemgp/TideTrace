import React,{useEffect,useId,useState} from "react";
import {Link} from "react-router-dom";
import TraceStatusBadge from "./TraceStatusBadge.jsx";
import AdminIcon from "./AdminIcon.jsx";
import {useApp} from "../context/AppContext.jsx";
import {PHOTO_TYPES} from "../api/photos.js";
import AuthorAvatar from "./AuthorAvatar.jsx";
import {relativeTime} from "../api/relativeTime.js";

function TraceCardPhoto({trace,priority=false,detailPath="traces"}){
  const {readData,profile}=useApp();
  const [requested,setRequested]=useState(false);
  const deferred=profile?.data_saver&&!requested;
  const [url,setUrl]=useState("");
  const [status,setStatus]=useState("loading");
  const [loaded,setLoaded]=useState(false);

  useEffect(()=>{
    if(deferred)return;
    const controller=new AbortController();
    setUrl("");
    setStatus("loading");
    setLoaded(false);

    const loadPhoto=async()=>{
      try{
        let media=Array.isArray(trace?.trace_media)?trace.trace_media:[];

        if(!media.length&&trace?.id){
          const detail=await readData(
            `${detailPath}/${encodeURIComponent(trace.id)}`,
            {signal:controller.signal}
          );

          media=Array.isArray(detail?.trace_media)
            ?detail.trace_media
            :[];
        }

        const photo=media
          .filter(item=>PHOTO_TYPES.includes(item.mime_type))
          .sort((a,b)=>(a.sort_order??0)-(b.sort_order??0))[0];

        if(!photo?.id){
          if(!controller.signal.aborted)setStatus("none");
          return;
        }

        const data=await readData(
          `media/${encodeURIComponent(photo.id)}/url`,
          {signal:controller.signal}
        );

        if(!controller.signal.aborted){
          setUrl(data?.url||"");
          setStatus(data?.url?"ready":"unavailable");
        }
      }catch(error){
        if(!controller.signal.aborted){
          setUrl("");
          setStatus("unavailable");
        }
      }
    };

    loadPhoto();
    return()=>controller.abort();
  },[trace?.id,trace?.trace_media,readData,deferred,detailPath]);

  if(deferred)return <div className="trace-card-photo trace-card-photo-saver"><span>Data saver is on</span><button type="button" className="btn outline sm" onClick={()=>setRequested(true)}>Load photo</button></div>;

  if(url){
    // The photo is not a link of its own: the card has one link (the title), stretched over the whole card.
    return(
      <div className={`trace-card-photo${loaded?"":" trace-card-photo-loading"}`}>
        <img
          src={url}
          alt={trace?.title?`${trace.title} photo`:"Trace photo"}
          referrerPolicy="no-referrer"
          decoding="async"
          // Photos at the top of the page load straight away; the rest wait until they are near the screen.
          loading={priority?"eager":"lazy"}
          fetchPriority={priority?"high":"auto"}
          // Hidden (over the shimmer) until fully downloaded and decoded, so it appears whole instead of painting top to bottom.
          onLoad={(event)=>{const image=event.currentTarget;(image.decode?image.decode().catch(()=>{}):Promise.resolve()).then(()=>setLoaded(true));}}
          onError={()=>{setUrl("");setStatus("unavailable");}}
          style={{opacity:loaded?1:0,transition:"opacity .25s ease"}}
        />
      </div>
    );
  }

  if(status==="loading")return <div className="trace-card-photo trace-card-photo-loading" aria-hidden="true"/>;

  return(
    <div className="trace-card-photo trace-card-photo-fallback">
      <span>{status==="unavailable"?"Photo unavailable":"No photo"}</span>
    </div>
  );
}

// detailPath: where the photo list is read from when the row has none (staff read pending Traces from "moderation/traces").
// badges: extra pills shown on the card (for example "Flagged" or how long a Trace has waited).
export default function TraceCard({trace,to,linkState,priority=false,detailPath="traces",badges=null,selected=false}){
  const {profile}=useApp();
  const Tag=to?Link:"article";
  const uid=useId();
  // A trace titled with just its category says little, so the location takes the title's place.
  const generic=String(trace.title||"").trim().toLowerCase()===String(trace.category||"").trim().toLowerCase();
  const heading=generic&&trace.location?trace.location:trace.title;

  return(
    <article className={`tcard user-trace-card${selected?" is-selected":""}`} aria-current={selected?"true":undefined}>
      <style>{`
        .trace-card-photo{
          width:100%;
          aspect-ratio:16/10;
          border-radius:10px;
          background:#eef3f8;
          overflow:hidden;
          display:flex;
          align-items:center;
          justify-content:center;
        }
        .trace-card-photo img{
          width:100%;
          height:100%;
          object-fit:contain;
          display:block;
        }
        .trace-card-photo-fallback,
        .trace-card-photo-saver{
          color:var(--soft);
          font-size:var(--fs-meta);
        }
        .trace-card-photo-saver{
          flex-direction:column;
          gap:10px;
        }
        html.dark-mode .trace-card-photo{
          background:#101827;
        }
        html.dark-mode .trace-card-photo-fallback,
        html.dark-mode .trace-card-photo-saver{
          color:#a9b8cc;
        }
        .user-trace-card{position:relative;}
        .user-trace-card .trace-card-link::after{content:"";position:absolute;inset:0;border-radius:inherit;}
        .user-trace-card .trace-card-link:focus-visible{outline:none;}
        .user-trace-card .trace-card-link:focus-visible::after{outline:var(--focus-width) solid var(--focus-ring);outline-offset:2px;}
        .user-trace-card .trace-card-photo-saver button{position:relative;z-index:2;}
      `}</style>

      <TraceCardPhoto key={`${trace.id}:${Boolean(profile?.data_saver)}`} trace={trace} priority={priority} detailPath={detailPath}/>
      <Tag className="trace-card-link" {...(to?{to,state:linkState,"aria-labelledby":`${uid}-t`,"aria-describedby":`${uid}-m`}:{})}>

      <div className="t" id={`${uid}-t`}>{heading}</div>

      <div className="m" id={`${uid}-m`}>
        <span className="trace-card-author">
          <AuthorAvatar authorId={trace.author_id} name={trace.author} url={trace.author_avatar_url} />
          <span>{trace.author}{trace.posted&&<> · <time dateTime={trace.posted_iso} title={relativeTime(trace.posted_iso)}>{trace.posted}</time></>}</span>
        </span>

        <span className="user-category-label">
          {trace.category}
        </span>
      </div>

      <div className="m">
        {!(generic&&trace.location)&&<span className="user-card-location">
          <AdminIcon name="pin" size={13}/>
          {trace.location}
        </span>}

        {trace.status!=="approved"&&!badges&&(
          <TraceStatusBadge status={trace.status}/>
        )}
      </div>
      {badges&&<div className="m trace-card-badges">{badges}</div>}
      </Tag>
    </article>
  );
}
