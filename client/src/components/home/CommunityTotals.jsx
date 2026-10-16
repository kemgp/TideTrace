import {communityMetrics} from '../../hooks/useCommunitySummary.js';

export default function CommunityTotals({community}){
 return <div className="tt-igrid" aria-busy={community.loading}>
  {communityMetrics.map(([key,label])=><div className="tt-stat" key={key}>
   <b>{community.loading?<span className="tt-total-skeleton" aria-label="Loading total"/>:community.data?community.data[key].toLocaleString():'—'}</b>
   <span>{label}</span>
  </div>)}
 </div>;
}
