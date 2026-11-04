import useCommunitySummary from '../../hooks/useCommunitySummary.js';
import {useRef} from 'react';
import {Link} from 'react-router-dom';
import {useApp} from '../../context/AppContext.jsx';
import {ROLE_HOME} from '../../api/auth.js';
import PublicNavbar from '../../components/home/PublicNavbar.jsx';
import Hero from '../../components/home/Hero.jsx';
import Mission from '../../components/home/Mission.jsx';
import Features from '../../components/home/Features.jsx';
import Impact from '../../components/home/Impact.jsx';
import HowItWorks from '../../components/home/HowItWorks.jsx';
import RecentTraces from '../../components/home/RecentTraces.jsx';
import MetaBalls from '../../components/home/MetaBalls.jsx';
import {useReducedMotion,useReveals} from '../../components/home/motion.js';
import './home.css';
export default function Home(){
 const community=useCommunitySummary();
 const {role}=useApp();const ref=useRef(null);const reduced=useReducedMotion();useReveals(ref,reduced);
 const archive=role==='user'?'/user/traces':role?ROLE_HOME[role]:'/register';
 const archiveLabel=role==='user'?'Browse the full archive':role?'Go to your dashboard':'Join to see the full archive';
 const join=role==='user'?'/user/traces/upload':role?ROLE_HOME[role]:'/register';
 return <div className="tt-home" ref={ref}><a className="tt-skip" href="#home-main">Skip to content</a><PublicNavbar/><main id="home-main">
 <Hero reduced={reduced} join={join} cta={role==='user'?'Add a Trace':role?'Go to dashboard':'Make Your First Trace'}/><Mission/><Features/><RecentTraces reduced={reduced} href={archive} label={archiveLabel}/><Impact community={community} reduced={reduced}/><HowItWorks/>
 <section className="tt-hsec tt-edge tt-edge-tan tt-quote"><div className="tt-wrap"><blockquote>"Small acts have large impact. Through many small actions, the collective becomes visible."</blockquote><svg className="tt-quote-wave" viewBox="0 0 220 14" preserveAspectRatio="none" aria-hidden="true"><path d="M2 8 Q 16 0 30 8 T 58 8 T 86 8 T 114 8 T 142 8 T 170 8 T 198 8 T 218 8" pathLength="1" fill="none" stroke="#CE6D38" strokeWidth="2.5" strokeLinecap="round"/></svg><p>TideTrace vision statement</p></div></section>
 <section className="tt-hsec tt-edge tt-edge-white"><div className="tt-wrap"><div className="tt-final"><MetaBalls reduced={reduced}/><h2>Your first trace takes less than a minute.</h2><p>Join coastal communities already turning ordinary moments into a living archive of the sea.</p><div className="tt-actions"><Link className="tt-btn tt-clay" to={join}>Start Tracing</Link><a className="tt-btn tt-outline" href="#home-features">Learn more</a></div></div></div></section>
 </main></div>;
}
