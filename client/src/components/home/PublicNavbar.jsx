import {useState} from 'react';
import {Link} from 'react-router-dom';
import {useApp} from '../../context/AppContext.jsx';
import {ROLE_HOME} from '../../api/auth.js';
export function Brand(){return <><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0M2 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/></svg><span>TideTrace</span></>;}
const links=[['Our Mission','mission'],['Features','features'],['Impact','impact'],['How it Works','how']];
export default function PublicNavbar(){
 const [open,setOpen]=useState(false); const {role}=useApp();
 return <nav className="tt-nav" aria-label="Main navigation" onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);e.currentTarget.querySelector('button').focus();}}}>
 <div className="tt-wrap tt-nav-grid"><Link className="tt-brand" to="/" aria-label="TideTrace home"><Brand/></Link>
 <button className="tt-menu" aria-label={open?'Close menu':'Open menu'} aria-expanded={open} aria-controls="home-navigation" onClick={()=>setOpen(!open)}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d={open?'M6 6l12 12M6 18L18 6':'M3 6h18M3 12h18M3 18h18'}/></svg></button>
 <div id="home-navigation" className={`tt-navigation ${open?'is-open':''}`}><div className="tt-nav-links">{links.map(([label,id])=><a key={id} href={`#home-${id}`} onClick={()=>setOpen(false)}>{label}</a>)}</div>
 <div className="tt-nav-actions">{role?<Link className="tt-btn tt-clay" to={ROLE_HOME[role]}>Your dashboard</Link>:<><Link className="tt-login" to="/login">Log in</Link><Link className="tt-btn tt-clay" to="/register">Join TideTrace</Link></>}</div></div></div></nav>;
}
