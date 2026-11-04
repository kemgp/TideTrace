import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {useApp} from '../../context/AppContext.jsx';
import {ROLE_HOME} from '../../api/auth.js';
export function Brand(){return <><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0M2 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/></svg><span>TideTrace</span></>;}
const links=[['Our Mission','mission'],['Features','features'],['Impact','impact'],['How it Works','how']];
export default function PublicNavbar(){
 const [open,setOpen]=useState(false); const {role}=useApp();
 const {pathname}=useLocation();
 const [scrolled,setScrolled]=useState(false);
 const [active,setActive]=useState('');
 const [ink,setInk]=useState(null);
 const linksRef=useRef(null);
 const onHome=pathname==='/';
 useEffect(()=>setOpen(false),[pathname]);
 // Shadow and a slightly shorter bar once the page has moved.
 useEffect(()=>{
  const update=()=>setScrolled(window.scrollY>24);update();
  window.addEventListener('scroll',update,{passive:true});return()=>window.removeEventListener('scroll',update);
 },[]);
 // Highlight the link of the section that crosses the middle of the screen.
 useEffect(()=>{
  if(!onHome||!window.IntersectionObserver){setActive('');return;}
  const io=new IntersectionObserver(entries=>entries.forEach(e=>{
   const id=e.target.id.replace('home-','');
   if(e.isIntersecting)setActive(id);else setActive(current=>current===id?'':current);
  }),{rootMargin:'-45% 0px -50% 0px'});
  links.forEach(([,id])=>{const node=document.getElementById(`home-${id}`);if(node)io.observe(node);});
  return()=>io.disconnect();
 },[onHome]);
 // The underline slides to the active link (desktop only; the mobile menu uses a coloured link).
 useLayoutEffect(()=>{
  const measure=()=>{
   const node=linksRef.current?.querySelector('[aria-current="location"]');
   setInk(node&&node.offsetParent?{left:node.offsetLeft,width:node.offsetWidth}:null);
  };
  measure();window.addEventListener('resize',measure);return()=>window.removeEventListener('resize',measure);
 },[active]);
 return <nav className={`tt-nav${scrolled?' is-scrolled':''}`} aria-label="Main navigation" onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);e.currentTarget.querySelector('button').focus();}}}>
 <div className="tt-wrap tt-nav-grid"><Link className="tt-brand" to="/" aria-label="TideTrace home"><Brand/></Link>
 <button className="tt-menu" aria-label={open?'Close menu':'Open menu'} aria-expanded={open} aria-controls="home-navigation" onClick={()=>setOpen(!open)}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d={open?'M6 6l12 12M6 18L18 6':'M3 6h18M3 12h18M3 18h18'}/></svg></button>
 <div id="home-navigation" className={`tt-navigation ${open?'is-open':''}`}><div className="tt-nav-links" ref={linksRef}>{links.map(([label,id])=><a key={id} href={`${pathname==='/'?'':'/'}#home-${id}`} aria-current={active===id?'location':undefined} onClick={()=>setOpen(false)}>{label}</a>)}<span className="tt-nav-ink" aria-hidden="true" style={ink?{transform:`translateX(${ink.left}px)`,width:ink.width,opacity:1}:{opacity:0}}/></div>
 <div className="tt-nav-actions">{role?<Link className="tt-btn tt-clay" to={ROLE_HOME[role]}>Go to dashboard</Link>:<><Link className="tt-login" to="/login">Log in</Link><Link className="tt-btn tt-clay" to="/register">Join TideTrace</Link></>}</div></div></div></nav>;
}
