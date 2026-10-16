import {useEffect,useState} from 'react';
export function useReducedMotion(){
 const [reduced,setReduced]=useState(()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true);
 useEffect(()=>{if(!window.matchMedia)return;const mq=window.matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(mq.matches);mq.addEventListener('change',update);return()=>mq.removeEventListener('change',update);},[]);
 useEffect(()=>{if(!reduced)return;const root=document.documentElement;const previous=root.style.scrollBehavior;root.style.scrollBehavior='auto';return()=>{root.style.scrollBehavior=previous;};},[reduced]);
 return reduced;
}
export function useReveals(ref,reduced){
 useEffect(()=>{
  if(reduced||!window.IntersectionObserver)return;
  const nodes=ref.current.querySelectorAll('.tt-sh,.tt-pillar,.tt-step,.tt-quote blockquote,.tt-final');
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.remove('tt-pending');entry.target.classList.add('tt-revealing');observer.unobserve(entry.target);}}),{threshold:0.12});
  nodes.forEach((node,i)=>{node.style.setProperty('--delay',`${node.matches('.tt-pillar,.tt-step')?i%4*80:0}ms`);node.classList.add('tt-pending');observer.observe(node);});
  const done=e=>e.target.classList.remove('tt-revealing');ref.current.addEventListener('animationend',done);const host=ref.current;
  return()=>{observer.disconnect();host.removeEventListener('animationend',done);nodes.forEach(n=>n.classList.remove('tt-pending','tt-revealing'));};
 },[ref,reduced]);
}
