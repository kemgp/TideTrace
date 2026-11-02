import React,{useEffect,useState} from "react";
import {Link} from "react-router-dom";
import TraceStatusBadge from "./TraceStatusBadge.jsx";
import AdminIcon from "./AdminIcon.jsx";
import {useApp} from "../context/AppContext.jsx";
import {PHOTO_TYPES} from "../api/photos.js";
import AuthorAvatar from "./AuthorAvatar.jsx";

function TraceCardPhoto({trace,to,linkState}){
  const {readData,profile}=useApp();
  const [requested,setRequested]=useState(false);
  const deferred=profile?.data_saver&&!requested;
  const [url,setUrl]=useState("");
  const [status,setStatus]=useState("loading");

  useEffect(()=>{
    if(deferred)return;
    const controller=new AbortController();
    setUrl("");
    setStatus("loading");

    const loadPhoto=async()=>{
      try{
        let media=Array.isArray(trace?.trace_media)?trace.trace_media:[];

        if(!media.length&&trace?.id){
          const detail=await readData(
            `traces/${encodeURIComponent(trace.id)}`,
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
  },[trace?.id,trace?.trace_media,readData,deferred]);

  if(deferred)return <div className="trace-card-photo trace-card-photo-saver"><span>Data saver is on</span><button type="button" className="btn outline sm" onClick={()=>setRequested(true)}>Load photo</button></div>;

  if(url){
    const PhotoTag=to?Link:"div";
    return(
      <PhotoTag className="trace-card-photo" {...(to?{to,state:linkState}:{})}>
        <img
          src={url}
          alt={trace?.title?`${trace.title} photo`:"Trace photo"}
          referrerPolicy="no-referrer"
          onError={()=>{setUrl("");setStatus("unavailable");}}
        />
      </PhotoTag>
    );
  }

  if(status==="loading")return <div className="trace-card-photo trace-card-photo-loading" aria-hidden="true"/>;

  return(
    <div className="trace-card-photo trace-card-photo-fallback">
      <span>{status==="unavailable"?"Photo unavailable":"No photo"}</span>
    </div>
  );
}

export default function TraceCard({trace,to,linkState}){
  const {profile}=useApp();
  const Tag=to?Link:"article";

  return(
    <article className="tcard user-trace-card">
      <style>{`
        .trace-card-photo{
          width:100%;
          height:220px;
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
        @media(max-width:640px){
          .trace-card-photo{
            height:200px;
          }
        }
      `}</style>

      <TraceCardPhoto key={`${trace.id}:${Boolean(profile?.data_saver)}`} trace={trace} to={to} linkState={linkState}/>
      <Tag {...(to?{to,state:linkState}:{})}>

      <div className="t">{trace.title}</div>

      <div className="m">
        <span className="trace-card-author">
          <AuthorAvatar authorId={trace.author_id} name={trace.author} url={trace.author_avatar_url} />
          <span>{trace.author}{trace.when&&` · ${trace.when}`}</span>
        </span>

        <span className="user-category-label">
          {trace.category}
        </span>
      </div>

      <div className="m">
        <span className="user-card-location">
          <AdminIcon name="pin" size={13}/>
          {trace.location}
        </span>

        {trace.status!=="approved"&&(
          <TraceStatusBadge status={trace.status}/>
        )}
      </div>
      </Tag>
    </article>
  );
}
