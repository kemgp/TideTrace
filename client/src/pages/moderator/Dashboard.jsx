import useDashboard from "../../hooks/useDashboard.js";
import DashboardStats from "../../components/DashboardStats.jsx";
import React,{useEffect,useState} from "react";
import StaffIcon from "../../components/AdminIcon.jsx";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";
import useRemoteData from "../../hooks/useRemoteData.js";
import { displayTrace } from "../../api/data.js";
import RemoteState from "../../components/RemoteState.jsx";
import Button from "../../components/Button.jsx";
import {PHOTO_TYPES} from "../../api/photos.js";


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

const getSubmittedDate = (trace) => {
  const raw =
    trace?.created_at ||
    trace?.submitted_at ||
    trace?.createdAt ||
    trace?.submittedAt ||
    trace?.date;

  if (!raw) return "";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString();
};

export default function Dashboard() {
  const { profile } = useApp();
  const navigate = useNavigate();

  const result = useRemoteData(
    "moderation/traces?status=pending&limit=4&offset=0",
    { collection: true }
  );

  const pending = (result.data || []).map(displayTrace);
  const totals = useDashboard();
  const oldest = pending.slice(0, 4);

  return (
    <div className="wrap">
      <style>{`
        .moderator-queue-grid{
          display:grid;
          grid-template-columns:repeat(3,minmax(0,1fr));
          gap:16px;
        }

        .moderator-queue-card{
          border:1px solid #cfe0f4;
          border-radius:14px;
          background:#fff;
          overflow:hidden;
          min-width:0;
          display:flex;
          flex-direction:column;
        }

        .moderator-queue-photo{
          margin:12px 12px 0;
          height:220px;
          border-radius:10px;
          background:#edf6fc;
          overflow:hidden;
          display:flex;
          align-items:center;
          justify-content:center;
        }

        .moderator-queue-image{
          width:100%;
          height:100%;
          object-fit:contain;
          display:block;
        }

        .moderator-queue-photo-empty{
          color:#6d84a7;
          font-size:13px;
        }

        .moderator-queue-content{
          padding:14px 16px 16px;
          display:flex;
          flex-direction:column;
          gap:9px;
          flex:1;
        }

        .moderator-queue-title{
          margin:0;
          color:#12326b;
          font-size:18px;
          font-weight:800;
        }

        .moderator-queue-meta{
          margin:0;
          color:#6d84a7;
          font-size:13px;
        }

        .moderator-queue-tags{
          display:flex;
          flex-wrap:wrap;
          gap:8px;
        }

        .moderator-queue-tag{
          display:inline-flex;
          align-items:center;
          min-height:30px;
          padding:0 12px;
          border:1px solid #c8dcf4;
          border-radius:999px;
          color:#637da7;
          font-size:12px;
          background:#fff;
        }

        .moderator-queue-footer{
          margin-top:auto;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
        }

        .moderator-queue-date{
          color:#6d84a7;
          font-size:12px;
        }

        .moderator-review-btn{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          gap:7px;
          padding:9px 16px;
          border-radius:10px;
          background:#f8ead7;
          color:#975a12;
          font-size:13px;
          font-weight:700;
          text-decoration:none;
          white-space:nowrap;
        }

        .moderator-review-btn:hover{
          background:#f3dfc4;
        }

        html.dark-mode .moderator-queue-card{
          background:#172235;
          border-color:#34445d;
        }

        html.dark-mode .moderator-queue-photo{
          background:#101827;
        }

        html.dark-mode .moderator-queue-title{
          color:#e7eef7;
        }

        html.dark-mode .moderator-queue-meta,
        html.dark-mode .moderator-queue-date{
          color:#9eafc6;
        }

        html.dark-mode .moderator-queue-tag{
          background:#172235;
          border-color:#34445d;
          color:#b7c4d7;
        }

        @media(max-width:900px){
          .moderator-queue-grid{
            grid-template-columns:repeat(2,minmax(0,1fr));
          }
        }

        @media(max-width:640px){
          .moderator-queue-grid{
            grid-template-columns:1fr;
          }

          .moderator-queue-photo{
            height:240px;
          }
        }
      `}</style>

      <div className="banner mod">
        <div>
          <b>Magandang umaga, {profile?.display_name} — review queue</b>
          <div className="s">Review. Verify. Keep the community safe.</div>
        </div>

        <svg
          width={34}
          height={34}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="1.8"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      </div>

      <DashboardStats
        result={totals}
        items={[
          ["pending", "Pending review"],
          ["flagged_comments", "Comments with open reports"],
          ["open_reports", "Open reports"],
          ["reviewed_today", "My reviews today (Manila)"],
        ]}
      />

      <h3 className="sec-t">Quick actions</h3>

      <div className="g2">
        <Button
          variant="teal"
          onClick={() => navigate("/moderator/review")}
        >
          ✓ Review pending traces
        </Button>

        <Button
          variant="outline"
          onClick={() => navigate("/moderator/reports")}
        >
          <StaffIcon name="flag" size={16} /> Open reported content
        </Button>
      </div>

      <h3 className="sec-t">Oldest in the queue</h3>

      <RemoteState compact {...result} />

      {!result.loading && !result.error && (
        oldest.length ? (
          <div className="moderator-queue-grid">
            {oldest.map((t) => {
              const submittedDate = getSubmittedDate(t);

              return (
                <div className="moderator-queue-card" key={t.id}>
                  <div className="moderator-queue-photo">
                    <TraceQueuePhoto
                      trace={t}
                      className="moderator-queue-image"
                      emptyClassName="moderator-queue-photo-empty"
                    />
                  </div>

                  <div className="moderator-queue-content">
                    <h4 className="moderator-queue-title">{t.title}</h4>

                    <p className="moderator-queue-meta">
                      Submitted by {t.author}
                    </p>

                    <div className="moderator-queue-tags">
                      {t.category && (
                        <span className="moderator-queue-tag">
                          {t.category}
                        </span>
                      )}

                      {t.location && (
                        <span className="moderator-queue-tag">
                          {t.location}
                        </span>
                      )}
                    </div>

                    <div className="moderator-queue-footer">
                      <span className="moderator-queue-date">
                        {submittedDate}
                      </span>

                      <Link
                        className="moderator-review-btn"
                        to={`/moderator/review/${encodeURIComponent(t.id)}`}
                      >
                        Review <span aria-hidden="true">›</span>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="hint">
            Queue clear — nothing pending right now.
          </p>
        )
      )}
    </div>
  );
}
