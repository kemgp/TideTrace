import {useRef} from 'react';
import {Link} from 'react-router-dom';
import useRecentTraces from '../../hooks/useRecentTraces.js';
import {useCompactPointer,useInView} from './motion.js';

function Tile({tile}){
 return <figure className="tt-trace">
  <img src={tile.url} alt={`${tile.title} photo`} loading="lazy" decoding="async" referrerPolicy="no-referrer"/>
  <figcaption><b>{tile.title}</b><span>{[tile.category,tile.place].filter(Boolean).join(' · ')}</span></figcaption>
 </figure>;
}

// A calm strip of real, approved community traces. It loads only when it is about to be seen and
// disappears if there is too little to show, so the landing page never has an empty gap.
export default function RecentTraces({reduced:reducedMotion,href,label}){
 // Still, swipeable row for reduced motion, small screens and touch devices; the slow drift (paused on
 // hover and keyboard focus) is only for larger screens with a pointer.
 const compact=useCompactPointer();
 const reduced=reducedMotion||compact;
 const ref=useRef(null);
 const saver=Boolean(window.navigator?.connection?.saveData);
 const supported=Boolean(window.IntersectionObserver)&&!saver;
 const near=useInView(ref,'400px');
 const {status,tiles}=useRecentTraces(supported&&near);
 if(!supported||status==='empty')return null;
 const ready=status==='ready';
 return <section className="tt-hsec tt-edge tt-edge-white tt-traces" id="home-traces" ref={ref} aria-labelledby="home-traces-title" aria-busy={!ready}>
  <div className="tt-wrap">
   <div className="tt-sh"><span className="tt-tagline">Seen lately</span><h2 id="home-traces-title">Recent traces from the community</h2><p>Real observations shared by people along the coast.</p></div>
  </div>
  <div className={`tt-trace-rail${reduced?' is-static':''}`} tabIndex={reduced&&ready?0:undefined} role={reduced&&ready?'region':undefined} aria-label={reduced&&ready?'Recent traces, scroll sideways':undefined}>
   {!ready?<div className="tt-trace-track" aria-hidden="true">{[1,2,3,4,5].map(i=><div className="tt-trace sk" key={i}/>)}</div>
   :<><div className="tt-trace-track">{tiles.map(tile=><Tile tile={tile} key={tile.id}/>)}{!reduced&&tiles.map(tile=><div className="tt-trace-clone" aria-hidden="true" key={`${tile.id}-copy`}><Tile tile={tile}/></div>)}</div></>}
  </div>
  <div className="tt-wrap tt-traces-more"><Link className="tt-btn tt-outline" to={href}>{label}</Link></div>
 </section>;
}
