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

// Phones and data-saver users get the static gradient instead of the WebGL waves.
export function useStaticBackdrop(){
 const query='(max-width: 480px)';
 const read=()=>Boolean(window.navigator?.connection?.saveData)||(window.matchMedia?.(query).matches??false);
 const [value,setValue]=useState(read);
 useEffect(()=>{
  if(!window.matchMedia)return;
  const mq=window.matchMedia(query);const update=()=>setValue(read());
  mq.addEventListener?.('change',update);return()=>mq.removeEventListener?.('change',update);
 },[]);
 return value;
}
// Counts from 0 to `target` once `active` turns true. Returns the number to display.
export function useCountUp(target,active,reduced,duration=900){
 const [value,setValue]=useState(reduced?target:0);
 useEffect(()=>{
  if(reduced||!Number.isFinite(target)){setValue(target);return;}
  if(!active){setValue(0);return;}
  let frame=0,start=0;
  const tick=now=>{
   start=start||now;const t=Math.min(1,(now-start)/duration);
   setValue(Math.round(target*(1-Math.pow(1-t,3))));
   if(t<1)frame=requestAnimationFrame(tick);
  };
  frame=requestAnimationFrame(tick);
  return()=>cancelAnimationFrame(frame);
 },[target,active,reduced,duration]);
 return value;
}
// True after the element has scrolled into view once.
export function useInView(ref,rootMargin='0px'){
 const [seen,setSeen]=useState(()=>!window.IntersectionObserver);
 useEffect(()=>{
  if(seen||!ref.current)return;
  const io=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setSeen(true);io.disconnect();}},{rootMargin,threshold:0.2});
  io.observe(ref.current);return()=>io.disconnect();
 },[ref,seen,rootMargin]);
 return seen;
}
// True on narrow screens and on devices that cannot hover (phones, tablets).
export function useCompactPointer(){
 const query='(max-width: 768px), (hover: none)';
 const read=()=>window.matchMedia?.(query).matches??false;
 const [value,setValue]=useState(read);
 useEffect(()=>{
  if(!window.matchMedia)return;
  const mq=window.matchMedia(query);const update=()=>setValue(read());
  mq.addEventListener?.('change',update);return()=>mq.removeEventListener?.('change',update);
 },[]);
 return value;
}
