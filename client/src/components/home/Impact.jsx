import CommunityTotals from './CommunityTotals.jsx';

export default function Impact({community}){
 return <section className="tt-hsec tt-impact" id="home-impact"><div className="tt-wrap">
  <div className="tt-sh"><span className="tt-tagline">Community participation</span><h2>Our community in numbers</h2><p>Published observations, community contributions, and learning milestones.</p></div>
  <CommunityTotals community={community}/>
  {community.error&&<div className="tt-community-error" role="alert"><p>{community.error}</p><button className="tt-btn tt-outline" onClick={community.retry}>Retry community totals</button></div>}
 </div></section>;
}
