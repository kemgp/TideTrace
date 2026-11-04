import GradientWaves from './reactbits/GradientWaves.jsx';
import StrokeText from './StrokeText.jsx';
import {Link} from 'react-router-dom';
import {useStaticBackdrop} from './motion.js';
export default function Hero({reduced,join,cta='Make Your First Trace'}){
 const staticBackdrop=useStaticBackdrop();
 return <header className="tt-hero" id="home-top">
 <div className="tt-ocean" aria-hidden="true">{!staticBackdrop&&<GradientWaves key={String(reduced)} horizonColor="#D9E5F2" waveColor="#8DC0C6" crestColor="#F5DBC5" lightMode speed={0.4} amplitude={2.5} relief={1} lightAngle={120} sheen={0.6} grain={0.12} mouseInteraction swellOnClick dpr={1.5} quality="medium"/>}</div>
 <div className="tt-noise" aria-hidden="true"/>
 <div className="tt-hero-content tt-wrap">
 {/* A plain label, not a pill: it looked like a button but did nothing. */}
 <span className="tt-static-pill">Explore · Contribute · Learn</span>
 <StrokeText reduced={reduced}/>
 <p className="tt-lead">TideTrace turns ordinary sightings, clean-ups, and stories from coastal communities into a living archive. Closing the gap between people and the crises we're facing, one trace at a time.</p>
 <div className="tt-actions"><Link className="tt-btn tt-clay" to={join}>{cta}</Link><a className="tt-btn tt-outline" href="#home-how">See how it works</a></div>
 </div><WaveDivider/></header>;
}
function WaveDivider(){return <svg className="tt-waves" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true">{[[38,12,'rgba(90,162,168,.16)',26],[56,36,'rgba(49,78,157,.10)',17],[34,10,'#fff',11]].map(([y,q,color,duration],i)=>{
 const d=`M0 ${y} Q72 ${q} 144 ${y} `+Array.from({length:9},(_,j)=>`T${(j+2)*144} ${y}`).join(' ');
 return <g key={i} className="tt-wave-layer" style={{animationDuration:`${duration}s`,animationDirection:i===1?'reverse':'normal'}}>{[0,1440].map(x=><g key={x} transform={`translate(${x} 0)`}><path d={`${d} V124 H0 Z`} fill={color}/>{i===2&&<path d={d} fill="none" stroke="#5AA2A8" strokeWidth="2"/>}</g>)}</g>;
 })}</svg>;}
