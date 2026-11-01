import {useRef} from 'react';
import {communityMetrics} from '../../hooks/useCommunitySummary.js';
import {useCountUp,useInView} from './motion.js';

function Stat({label,value,loading,reduced}){
 const ref=useRef(null);
 const seen=useInView(ref);
 const shown=useCountUp(value??0,seen&&value!=null,reduced);
 const animated=!reduced&&value!=null;
 return <div className="tt-stat" ref={ref}>
  <b>{loading?<span className="tt-total-skeleton" aria-label="Loading total"/>:value==null?'—':animated?<><span aria-hidden="true">{shown.toLocaleString()}</span><span className="sr-only">{value.toLocaleString()}</span></>:value.toLocaleString()}</b>
  <span>{label}</span>
 </div>;
}

export default function CommunityTotals({community,reduced=true}){
 return <div className="tt-igrid" aria-busy={community.loading}>
  {communityMetrics.map(([key,label])=><Stat key={key} label={label} loading={community.loading} reduced={reduced} value={community.data?community.data[key]:null}/>)}
 </div>;
}
