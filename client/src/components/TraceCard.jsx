import React,{useEffect,useState} from "react";
import {Link} from "react-router-dom";
import TraceStatusBadge from "./TraceStatusBadge.jsx";
import {traceColor} from "./TraceCategory.jsx";
import AdminIcon from "./AdminIcon.jsx";
import {useApp} from "../context/AppContext.jsx";
import {PHOTO_TYPES} from "../api/photos.js";

function TraceCardPhoto({trace}){
  const {readData}=useApp();
  const [url,setUrl]=useState("");
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    const controller=new AbortController();
    setUrl("");
    setLoading(true);

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
          if(!controller.signal.aborted)setLoading(false);
          return;
        }

        const data=await readData(
          `media/${encodeURIComponent(photo.id)}/url`,
          {signal:controller.signal}
        );

        if(!controller.signal.aborted){
          setUrl(data?.url||"");
          setLoading(false);
        }
      }catch(error){
        if(!controller.signal.aborted){
          setUrl("");
          setLoading(false);
        }
      }
    };

    loadPhoto();
    return()=>controller.abort();
  },[trace?.id,trace?.trace_media,readData]);

  if(url){
    return(
      <div className="trace-card-photo">
        <img
          src={url}
          alt={trace?.title?`${trace.title} photo`:"Trace photo"}
          referrerPolicy="no-referrer"
          onError={()=>setUrl("")}
        />
      </div>
    );
  }

  return(
    <div
      className="trace-card-photo trace-card-photo-fallback"
      style={{background:traceColor(trace.category)}}
      aria-hidden="true"
    >
      {!loading&&<span>No photo</span>}
    </div>
  );
}

export default function TraceCard({trace,to}){
  const Tag=to?Link:"article";

  return(
    <Tag
      className="tcard user-trace-card"
      {...(to?{to}:{})}
    >
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
        .trace-card-photo-fallback{
          color:#fff;
          font-size:13px;
        }
        html.dark-mode .trace-card-photo{
          background:#101827;
        }
        @media(max-width:640px){
          .trace-card-photo{
            height:200px;
          }
        }
      `}</style>

      <TraceCardPhoto trace={trace}/>

      <div className="t">{trace.title}</div>

      <div className="m">
        <span>
          {trace.author}
          {trace.when&&` · ${trace.when}`}
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
  );
}