import React from "react";
const S=({className="",style})=><span className={`psk ${className}`} style={style}/>;
function DashboardSkeleton(){
  return <div className="ps-page">
    <S className="ps-banner"/>
    <div className="ps-stats">{[1,2,3,4].map(i=><S className="ps-stat" key={i}/>)}</div>
    <S className="ps-heading"/>
    <div className="ps-actions"><S/><S/></div>
    <S className="ps-heading short"/>
    <div className="ps-card-grid">{[1,2,3].map(i=><div className="ps-card" key={i}><S className="ps-photo"/><S className="ps-line lg"/><S className="ps-line"/><div className="ps-chips"><S/><S/></div></div>)}</div>
  </div>;
}
function ReviewQueueSkeleton(){
  return <div className="ps-page">
    <div className="ps-head"><S className="ps-kicker"/><S className="ps-title"/><S className="ps-subtitle"/></div>
    <div className="ps-chips">{[1,2,3,4,5,6,7].map(i=><S key={i}/>)}</div>
    <S className="ps-button"/>
    <div className="ps-card-grid">{[1,2,3].map(i=><div className="ps-card" key={i}><S className="ps-photo"/><S className="ps-line lg"/><S className="ps-line"/><div className="ps-chips"><S/><S/></div><div className="ps-row"><S className="ps-line sm"/><S className="ps-button small"/></div></div>)}</div>
  </div>;
}
function ListSkeleton({search=true}){
  return <div className="ps-page">
    <div className="ps-head"><S className="ps-kicker"/><S className="ps-title"/><S className="ps-subtitle"/></div>
    {search&&<S className="ps-search"/>}
    <div className="ps-list">{[1,2,3,4,5].map(i=><div className="ps-list-row" key={i}><S className="ps-avatar"/><div className="ps-grow"><S className="ps-line lg"/><S className="ps-line"/></div><S className="ps-button small"/></div>)}</div>
  </div>;
}
function CardsSkeleton(){
  return <div className="ps-page">
    <div className="ps-head"><S className="ps-kicker"/><S className="ps-title"/><S className="ps-subtitle"/></div>
    <S className="ps-search"/>
    <div className="ps-card-grid">{[1,2,3,4,5,6].map(i=><div className="ps-card" key={i}><S className="ps-photo"/><S className="ps-line lg"/><S className="ps-line"/><S className="ps-line sm"/></div>)}</div>
  </div>;
}
function DetailSkeleton(){
  return <div className="ps-page narrow">
    <S className="ps-button small"/>
    <div className="ps-detail-card">
      <S className="ps-photo hero"/>
      <S className="ps-title"/>
      <S className="ps-line"/>
      <div className="ps-chips"><S/><S/></div>
      <S className="ps-map"/>
      <S className="ps-heading"/>
      <S className="ps-paragraph"/>
      <S className="ps-paragraph"/>
    </div>
  </div>;
}
function FormSkeleton(){
  return <div className="ps-page narrow">
    <div className="ps-head"><S className="ps-kicker"/><S className="ps-title"/><S className="ps-subtitle"/></div>
    <div className="ps-form">
      {[1,2,3,4].map(i=><div className="ps-field" key={i}><S className="ps-label"/><S className="ps-input"/></div>)}
      <S className="ps-textarea"/>
      <div className="ps-actions"><S/><S/></div>
    </div>
  </div>;
}
function SettingsSkeleton(){
  return <div className="ps-page">
    <div className="ps-head"><S className="ps-kicker"/><S className="ps-title"/></div>
    <div className="ps-settings">
      <div className="ps-side">{[1,2,3,4,5].map(i=><S key={i}/>)}</div>
      <div className="ps-settings-body"><S className="ps-title"/>{[1,2,3,4].map(i=><div className="ps-setting-row" key={i}><div className="ps-grow"><S className="ps-line lg"/><S className="ps-line"/></div><S className="ps-toggle"/></div>)}</div>
    </div>
  </div>;
}
function AnalyticsSkeleton(){
  return <div className="ps-page">
    <div className="ps-head"><S className="ps-kicker"/><S className="ps-title"/><S className="ps-subtitle"/></div>
    <div className="ps-stats">{[1,2,3,4].map(i=><S className="ps-stat" key={i}/>)}</div>
    <div className="ps-chart-grid"><S className="ps-chart"/><S className="ps-chart"/></div>
    <S className="ps-chart wide"/>
  </div>;
}
function CommentsSkeleton(){
  return <div className="ps-page ps-narrow">
    <div className="ps-head"><S className="ps-kicker"/><S className="ps-title"/><S className="ps-subtitle"/></div>
    <div className="ps-chips">{[1,2,3].map(i=><S key={i}/>)}</div>
    <S className="ps-note"/>
    <div className="ps-comment-list">
      {[1,2,3].map(i=><div className="ps-comment-card" key={i}>
        <div className="ps-row"><S className="ps-line lg"/><S className="ps-line xs"/></div>
        <div className="ps-comment-author"><S className="ps-avatar"/><div className="ps-grow"><S className="ps-line sm"/><S className="ps-paragraph short"/></div></div>
        <div className="ps-reason"><S className="ps-label"/><S className="ps-line lg"/></div>
        <div className="ps-actions"><S/><S/></div>
      </div>)}
    </div>
  </div>;
}
function ReportsSkeleton(){
  return <div className="ps-page ps-report-page">
    <div className="ps-head"><S className="ps-kicker"/><S className="ps-title"/><S className="ps-subtitle"/></div>
    <div className="ps-chips">{[1,2,3].map(i=><S key={i}/>)}</div>
    <div className="ps-report-tools"><S className="ps-select"/><S className="ps-button"/></div>
    <div className="ps-report-list">
      {[1,2].map(i=><div className="ps-report-card" key={i}>
        <div className="ps-row"><S className="ps-badge"/><S className="ps-line xs"/></div>
        <S className="ps-line lg"/>
        <S className="ps-line"/>
        <div className="ps-reason"><S className="ps-line lg"/></div>
        <S className="ps-details"/>
        <S className="ps-line sm"/>
        <div className="ps-field"><S className="ps-label"/><S className="ps-textarea"/></div>
        <div className="ps-actions"><S/><S/></div>
      </div>)}
    </div>
  </div>;
}
function ContributionsSkeleton(){
  return <div className="ps-page">
    <div className="ps-headrow">
      <div className="ps-head">
        <S className="ps-kicker"/>
        <S className="ps-title"/>
        <S className="ps-subtitle"/>
      </div>
      <S className="ps-button small"/>
    </div>
    <div className="ps-chips ps-contrib-chips">{[1,2,3,4,5,6].map(i=><S key={i}/>)}</div>
    <div className="ps-contrib-list">
      {[1,2,3,4].map(i=><div className="ps-contrib-row" key={i}>
        <S className="ps-category-box"/>
        <div className="ps-grow">
          <S className="ps-line lg"/>
          <S className="ps-line"/>
        </div>
        <S className="ps-badge"/>
      </div>)}
    </div>
    <div className="ps-pagination">
      <S className="ps-button small"/>
      <S className="ps-line xs"/>
      <S className="ps-button small"/>
    </div>
  </div>;
}
function NotificationsSkeleton(){
  return <div className="ps-page ps-notifications-page">
    <div className="ps-headrow">
      <div className="ps-head">
        <S className="ps-kicker"/>
        <S className="ps-title"/>
        <S className="ps-subtitle"/>
      </div>
      <div className="ps-notification-actions">
        <S className="ps-button small"/>
        <S className="ps-button small wide"/>
      </div>
    </div>
    <div className="ps-notification-list">
      {[1,2,3,4,5].map(i=><div className="ps-notification-row" key={i}>
        <S className="ps-notification-icon"/>
        <div className="ps-grow">
          <S className="ps-line lg"/>
          <S className="ps-line sm"/>
        </div>
        <S className="ps-button small wide"/>
      </div>)}
    </div>
    <div className="ps-pagination">
      <S className="ps-button small"/>
      <S className="ps-line xs"/>
      <S className="ps-button small"/>
    </div>
  </div>;
}
function UserProfileSkeleton(){
  return <div className="ps-page">
    <div className="ps-head">
      <S className="ps-kicker"/>
      <S className="ps-title"/>
    </div>
    <div className="ps-settings">
      <div className="ps-side">
        {[1,2,3,4,5].map(i=><S key={i}/>)}
      </div>
      <div className="ps-settings-body">
        <div className="ps-profile-head">
          <S className="ps-profile-avatar"/>
          <div className="ps-grow">
            <S className="ps-line lg"/>
            <S className="ps-line sm"/>
          </div>
        </div>
        <S className="ps-title"/>
        {[1,2,3].map(i=><div className="ps-setting-row" key={i}>
          <div className="ps-grow">
            <S className="ps-line lg"/>
            <S className="ps-line"/>
          </div>
        </div>)}
      </div>
    </div>
  </div>;
}
function AdminContentSkeleton(){
  return <div className="ps-page">
    <div className="ps-headrow">
      <div className="ps-head">
        <S className="ps-kicker"/>
        <S className="ps-title"/>
        <S className="ps-subtitle"/>
      </div>
      <S className="ps-button"/>
    </div>
    <div className="ps-content-tabs">
      <S/><S/><S/>
    </div>
    <S className="ps-button"/>
    <div className="ps-admin-content-list">
      {[1,2,3,4].map(i=><div className="ps-admin-content-row" key={i}>
        <S className="ps-lesson-icon"/>
        <div className="ps-grow">
          <S className="ps-line lg"/>
          <S className="ps-line sm"/>
        </div>
        <S className="ps-badge"/>
        <S className="ps-button small"/>
      </div>)}
    </div>
    <div className="ps-pagination">
      <S className="ps-button small"/>
      <S className="ps-line xs"/>
      <S className="ps-button small"/>
    </div>
  </div>;
}
function AdminHistorySkeleton(){
  return <div className="ps-page">
    <div className="ps-history-headrow">
      <div className="ps-head">
        <S className="ps-kicker ps-history-kicker"/>
        <S className="ps-history-title"/>
        <S className="ps-history-subtitle"/>
      </div>
      <div className="ps-history-actions">
        <S className="ps-history-top-btn"/>
        <S className="ps-history-top-btn small"/>
      </div>
    </div>
    <div className="ps-history-chips">
      {[52,98,92,94,66,98,100].map((w,i)=><S key={i} className="ps-history-chip" style={{width:w}}/>)}
    </div>
    <div className="ps-history-tools">
      <S className="ps-history-hint"/>
      <S className="ps-history-refresh"/>
    </div>
    <div className="ps-history-card">
      {[1,2,3,4,5,6,7].map((i)=><div className="ps-history-row" key={i}>
        <div className="ps-history-copy">
          <S className="ps-history-row-title"/>
          <S className="ps-history-row-meta"/>
          <S className="ps-history-row-reason"/>
        </div>
        <div className="ps-history-row-actions">
          <S className="ps-history-badge"/>
          {i>2&&<S className="ps-history-view-btn"/>}
        </div>
      </div>)}
    </div>
    <div className="ps-history-pagination">
      <S className="ps-history-page-btn"/>
      <S className="ps-history-page-label"/>
      <S className="ps-history-page-btn"/>
    </div>
  </div>;
}
function AdminProfileSkeleton(){
  return <div className="ps-page">
    <div className="ps-head">
      <S className="ps-kicker"/>
      <S className="ps-title"/>
    </div>
    <div className="ps-settings">
      <div className="ps-side">
        {[1,2,3,4,5,6].map(i=><S key={i}/>)}
      </div>
      <div className="ps-settings-body">
        <S className="ps-title"/>
        <S className="ps-subtitle"/>
        <div className="ps-admin-profile-grid">
          <div className="ps-admin-profile-card">
            <S className="ps-admin-avatar"/>
            <S className="ps-line lg"/>
            <S className="ps-line sm"/>
          </div>
          <div className="ps-admin-profile-info">
            {[1,2,3,4].map(i=><div className="ps-field" key={i}>
              <S className="ps-label"/>
              <S className="ps-input"/>
            </div>)}
          </div>
        </div>
      </div>
    </div>
  </div>;
}
function getType(path=""){
  if(path==="/user"||path==="/user/dashboard"||path==="/moderator/dashboard"||path==="/admin/dashboard")return "dashboard";
  if(path==="/moderator/review"||path==="/admin/review")return "review";
  if(path==="/admin/review/history")return "adminhistory";
  if(path.includes("/review/history"))return "list";
  if(/^\/(moderator|admin)\/review\/[^/]+$/.test(path))return "detail";
  if(path==="/moderator/comments")return "comments";
  if(path==="/moderator/reports"||path==="/admin/reports")return "reports";
  if(path.endsWith("/analytics"))return "analytics";
  if(path==="/user/profile")return "userprofile";
  if(path==="/admin/profile")return "adminprofile";
  if(path.endsWith("/profile")||path==="/admin/settings")return "settings";
  if(path==="/user/contributions")return "contributions";
  if(path==="/admin/tides")return "admincontent";
  if(path==="/admin/review/history")return "adminhistory";
  if(path==="/admin/profile")return "adminprofile";
  if(path==="/user/traces"||path==="/user/tides")return "cards";
  if(path==="/user/notifications")return "notifications";
  if(path==="/admin/users"||path==="/admin/moderators"||path==="/admin/categories")return "list";
  if(path==="/user/traces/upload"||path==="/admin/tides/new"||/\/admin\/tides\/[^/]+\/edit$/.test(path)||/\/user\/contributions\/[^/]+\/edit$/.test(path))return "form";
  if(/^\/user\/traces\/[^/]+$/.test(path)||/^\/user\/tides\/[^/]+$/.test(path)||/^\/user\/contributions\/[^/]+$/.test(path))return "detail";
  return "list";
}
export default function SkeletonLoader({path=""}){
  const type=getType(path);
  return <section className="page-transition-skeleton" role="status" aria-label="Loading content" aria-busy="true" data-skeleton-type={type}>
    <style>{`
      @keyframes pskShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
      .page-transition-skeleton{width:min(1120px,calc(100% - 32px));margin:32px auto;min-height:420px}
      .ps-page{display:block}.ps-page.narrow{max-width:760px;margin:0 auto}
      .psk{display:block;background:linear-gradient(90deg,#e5eaf1 25%,#f7f9fc 50%,#e5eaf1 75%);background-size:200% 100%;animation:pskShimmer 1.4s ease-in-out infinite;border-radius:8px}
      .ps-banner{height:112px;border-radius:14px;margin-bottom:24px}
      .ps-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:24px}.ps-stat{height:105px;border:1px solid #d5e2ef;border-radius:12px}
      .ps-heading{width:210px;height:22px;margin:24px 0 16px}.ps-heading.short{width:170px}
      .ps-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.ps-actions>.psk{height:46px;border-radius:10px}
      .ps-head{margin-bottom:20px}.ps-kicker{width:100px;height:14px;margin-bottom:12px}.ps-title{width:min(360px,70%);height:30px;margin-bottom:10px}.ps-subtitle{width:min(560px,90%);height:14px}
      .ps-search{width:280px;height:40px;margin:14px 0 18px}.ps-button{width:130px;height:38px;margin:12px 0}.ps-button.small{width:92px;height:34px;margin:0}
      .ps-card-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:16px}.ps-card{border:1px solid #d5e2ef;border-radius:14px;padding:12px;background:var(--card,#fff)}.ps-photo{height:190px;border-radius:10px;margin-bottom:14px}.ps-photo.hero{height:300px}
      .ps-line{height:12px;width:65%;margin:9px 0}.ps-line.lg{height:18px;width:82%}.ps-line.sm{width:42%}.ps-line.xs{width:80px}
      .ps-chips{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.ps-chips>.psk{width:90px;height:30px;border-radius:999px}
      .ps-row{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:14px}
      .ps-list{border:1px solid #d5e2ef;border-radius:12px;overflow:hidden;background:var(--card,#fff)}.ps-list-row{display:flex;align-items:center;gap:14px;padding:16px;border-bottom:1px solid #e5edf6}.ps-list-row:last-child{border-bottom:0}.ps-avatar{width:42px;height:42px;border-radius:50%;flex:none}.ps-grow{flex:1;min-width:0}
      .ps-detail-card,.ps-form,.ps-settings-body{border:1px solid #d5e2ef;border-radius:12px;padding:20px;background:var(--card,#fff)}.ps-map{height:220px;margin:20px 0}.ps-paragraph{height:60px;margin:12px 0}
      .ps-field{margin-bottom:16px}.ps-label{width:110px;height:12px;margin-bottom:8px}.ps-input{height:42px;width:100%}.ps-textarea{height:120px;margin-bottom:18px}
      .ps-settings{display:grid;grid-template-columns:230px minmax(0,1fr);gap:24px}.ps-side{border:1px solid #d5e2ef;border-radius:12px;padding:12px}.ps-side>.psk{height:44px;margin-bottom:8px}.ps-side>.psk:last-child{margin-bottom:0}.ps-setting-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:17px 0;border-bottom:1px solid #e5edf6}.ps-toggle{width:40px;height:23px;border-radius:999px;flex:none}
      .ps-chart-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin-bottom:18px}.ps-chart{height:260px;border:1px solid #d5e2ef;border-radius:12px}.ps-chart.wide{height:290px}
      .ps-content-tabs{display:flex;gap:10px;flex-wrap:wrap;margin:4px 0 18px}.ps-content-tabs>.psk{width:120px;height:38px;border-radius:10px}
      .ps-admin-content-list,.ps-admin-history-list{border:1px solid #d5e2ef;border-radius:12px;overflow:hidden;background:var(--card,#fff);margin-top:16px}
      .ps-admin-content-row,.ps-admin-history-row{display:flex;align-items:center;gap:14px;padding:16px;border-bottom:1px solid #e5edf6}
      .ps-admin-content-row:last-child,.ps-admin-history-row:last-child{border-bottom:0}
      .ps-lesson-icon{width:46px;height:46px;border-radius:10px;flex:none}
      .ps-history-actions{display:flex;gap:8px;flex-wrap:wrap}
      .ps-history-chips{margin:0 0 14px}
      .ps-history-tools{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:10px 0 14px}
      .ps-admin-profile-grid{display:grid;grid-template-columns:220px minmax(0,1fr);gap:24px;margin-top:20px}
      .ps-admin-profile-card{border:1px solid #d5e2ef;border-radius:12px;padding:20px;text-align:center}
      .ps-admin-avatar{width:92px;height:92px;border-radius:50%;margin:0 auto 16px}
      .ps-admin-profile-info{min-width:0}
      html.dark-mode .ps-admin-content-list,html.dark-mode .ps-admin-history-list,html.dark-mode .ps-admin-profile-card{background:#172235;border-color:#34445d}
      html.dark-mode .ps-admin-content-row,html.dark-mode .ps-admin-history-row{border-color:#26354b}
      .ps-history-headrow{display:flex;align-items:flex-end;justify-content:space-between;gap:28px;margin-bottom:30px}
      .ps-history-headrow .ps-head{margin:0;flex:1}
      .ps-history-kicker{width:225px;height:34px;border-radius:18px;margin-bottom:24px}
      .ps-history-title{width:min(480px,80%);height:38px;margin-bottom:18px}
      .ps-history-subtitle{width:min(760px,95%);height:16px}
      .ps-history-actions{display:flex;gap:12px;align-items:center;padding-bottom:3px}
      .ps-history-top-btn{width:142px;height:52px;border-radius:12px}
      .ps-history-top-btn.small{width:95px}
      .ps-history-chips{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:28px}
      .ps-history-chip{height:52px;border-radius:20px}
      .ps-history-tools{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:28px}
      .ps-history-hint{width:350px;height:14px}
      .ps-history-refresh{width:112px;height:18px}
      .ps-history-card{border:1px solid #d5e2ef;border-radius:14px;background:var(--card,#fff);overflow:hidden}
      .ps-history-row{min-height:116px;display:flex;align-items:center;justify-content:space-between;gap:24px;padding:22px 28px}
      .ps-history-copy{flex:1;min-width:0}
      .ps-history-row-title{width:190px;height:18px;margin-bottom:10px}
      .ps-history-row-meta{width:250px;height:13px;margin-bottom:10px}
      .ps-history-row-reason{width:180px;height:13px}
      .ps-history-row-actions{display:flex;align-items:center;justify-content:flex-end;gap:18px;min-width:220px}
      .ps-history-badge{width:104px;height:27px;border-radius:999px}
      .ps-history-view-btn{width:88px;height:50px;border-radius:10px}
      .ps-history-pagination{display:flex;align-items:center;gap:12px;margin-top:22px}
      .ps-history-page-btn{width:120px;height:48px;border-radius:10px}
      .ps-history-page-label{width:55px;height:16px}
      html.dark-mode .ps-history-card{background:#172235;border-color:#34445d}
      .ps-headrow{display:flex;align-items:flex-start;justify-content:space-between;gap:20px}
      .ps-headrow .ps-head{flex:1}
      .ps-contrib-chips{margin:0 0 20px}
      .ps-contrib-list{border:1px solid #d5e2ef;border-radius:12px;overflow:hidden;background:var(--card,#fff)}
      .ps-contrib-row{display:flex;align-items:center;gap:14px;padding:16px;border-bottom:1px solid #e5edf6}
      .ps-contrib-row:last-child{border-bottom:0}
      .ps-category-box{width:46px;height:46px;border-radius:10px;flex:none}
      .ps-pagination{display:flex;align-items:center;gap:12px;margin-top:18px}
      .ps-notifications-page{max-width:720px;margin:0 auto}
      .ps-notification-actions{display:flex;gap:8px;flex-wrap:wrap}
      .ps-button.wide{width:116px}
      .ps-notification-list{margin-top:8px}
      .ps-notification-row{display:flex;align-items:center;gap:14px;padding:15px 0;border-bottom:1px solid #e5edf6}
      .ps-notification-icon{width:38px;height:38px;border-radius:50%;flex:none}
      .ps-profile-head{display:flex;align-items:center;gap:14px;padding-bottom:18px;margin-bottom:18px;border-bottom:1px solid #e5edf6}
      .ps-profile-avatar{width:54px;height:54px;border-radius:50%;flex:none}
      html.dark-mode .ps-contrib-list{background:#172235;border-color:#34445d}
      html.dark-mode .ps-contrib-row,html.dark-mode .ps-notification-row,html.dark-mode .ps-profile-head{border-color:#26354b}
      .ps-narrow{max-width:800px;margin:0 auto}
      .ps-note{width:min(560px,90%);height:14px;margin:14px 0 18px}
      .ps-comment-list,.ps-report-list{display:grid;gap:16px}
      .ps-comment-card,.ps-report-card{border:1px solid #d5e2ef;border-radius:12px;padding:18px;background:var(--card,#fff)}
      .ps-comment-author{display:flex;align-items:flex-start;gap:12px;margin:16px 0}
      .ps-paragraph.short{height:42px;margin:8px 0 0}
      .ps-reason{padding:14px;border-radius:10px;background:#f7f9fc;margin:14px 0}
      .ps-report-page{max-width:800px;margin:0 auto}
      .ps-report-tools{display:flex;align-items:end;gap:12px;flex-wrap:wrap;margin:14px 0 18px}
      .ps-select{width:240px;height:42px}
      .ps-badge{width:82px;height:26px;border-radius:999px}
      .ps-details{width:180px;height:18px;margin:14px 0}
      html.dark-mode .ps-comment-card,html.dark-mode .ps-report-card{background:#172235;border-color:#34445d}
      html.dark-mode .ps-reason{background:#101827}
      html.dark-mode .psk{background:linear-gradient(90deg,#1d293b 25%,#2a384e 50%,#1d293b 75%);background-size:200% 100%}
      html.dark-mode .ps-card,html.dark-mode .ps-list,html.dark-mode .ps-detail-card,html.dark-mode .ps-form,html.dark-mode .ps-settings-body,html.dark-mode .ps-side{background:#172235;border-color:#34445d}
      html.dark-mode .ps-list-row,html.dark-mode .ps-setting-row{border-color:#26354b}
      @media(max-width:900px){.ps-admin-profile-grid{grid-template-columns:1fr}.ps-card-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.ps-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.ps-settings{grid-template-columns:1fr}.ps-chart-grid{grid-template-columns:1fr}}
      @media(max-width:640px){.ps-history-headrow{display:block}.ps-history-actions{margin-top:18px}.ps-history-row{align-items:flex-start;padding:18px}.ps-history-row-actions{min-width:0;flex-direction:column;align-items:flex-end}.ps-headrow{display:block}.ps-notification-actions{margin-bottom:16px}.ps-card-grid,.ps-stats,.ps-actions{grid-template-columns:1fr}.ps-photo{height:220px}.ps-search{width:100%}.page-transition-skeleton{width:min(100% - 24px,1120px)}}
      @media(prefers-reduced-motion:reduce){.psk{animation:none}}
    `}</style>
    {type==="dashboard"&&<DashboardSkeleton/>}
    {type==="review"&&<ReviewQueueSkeleton/>}
    {type==="cards"&&<CardsSkeleton/>}
    {type==="detail"&&<DetailSkeleton/>}
    {type==="form"&&<FormSkeleton/>}
    {type==="settings"&&<SettingsSkeleton/>}
    {type==="analytics"&&<AnalyticsSkeleton/>}
    {type==="notifications"&&<NotificationsSkeleton/>}
    {type==="contributions"&&<ContributionsSkeleton/>}
    {type==="userprofile"&&<UserProfileSkeleton/>}
    {type==="admincontent"&&<AdminContentSkeleton/>}
    {type==="adminhistory"&&<AdminHistorySkeleton/>}
    {type==="adminprofile"&&<AdminProfileSkeleton/>}
    {type==="comments"&&<CommentsSkeleton/>}
    {type==="reports"&&<ReportsSkeleton/>}
    {type==="list"&&<ListSkeleton/>}
  </section>;
}
