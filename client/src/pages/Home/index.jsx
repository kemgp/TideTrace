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
import MetaBalls from '../../components/home/MetaBalls.jsx';
import {useReducedMotion,useReveals} from '../../components/home/motion.js';
import './home.css';
export default function Home(){
 const community=useCommunitySummary();
 const {role}=useApp();const ref=useRef(null);const reduced=useReducedMotion();useReveals(ref,reduced);
 const join=role==='user'?'/user/traces/upload':role?ROLE_HOME[role]:'/register';
 return <div className="tt-home" ref={ref}><a className="tt-skip" href="#home-main">Skip to content</a><PublicNavbar/><main id="home-main">
 <Hero reduced={reduced} join={join}/><Mission/><Features/><Impact community={community}/><HowItWorks/>
 <section className="tt-hsec tt-quote"><div className="tt-wrap"><blockquote>"Small acts have large impact. Through many small actions, the collective becomes visible."</blockquote><p>— TideTrace vision statement</p></div></section>
 <section className="tt-hsec"><div className="tt-wrap"><div className="tt-final"><MetaBalls reduced={reduced}/><h2>Your first trace takes less than a minute.</h2><p>Join coastal communities already turning ordinary moments into a living archive of the sea.</p><div className="tt-actions"><Link className="tt-btn tt-clay" to={join}>Start Tracing</Link><a className="tt-btn tt-outline" href="#home-features">Learn more</a></div></div></div></section>
 </main></div>;
}
