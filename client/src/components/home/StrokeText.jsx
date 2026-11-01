import {useEffect,useRef,useState} from 'react';
import {useStaticBackdrop} from './motion.js';
const lines=['Every small act becomes','visible care for the','sea.'];
export default function StrokeText({reduced}){
 const compact=useStaticBackdrop();const svg=useRef(null),animations=useRef([]);const [box,setBox]=useState(null);const [failed,setFailed]=useState(false);const [drawn,setDrawn]=useState(false);
 const draw=(fill=false)=>{
  animations.current.forEach(a=>a.cancel());animations.current=[];
  svg.current?.querySelectorAll('.tt-stroke-char').forEach((node,i)=>animations.current.push(node.animate([{strokeDashoffset:1200},{strokeDashoffset:0}],{duration:1600,delay:i*40,fill:'forwards',easing:'cubic-bezier(.22,.61,.36,1)'})));
  if(fill)svg.current?.querySelectorAll('.tt-fill-char').forEach((node,i)=>animations.current.push(node.animate([{opacity:0},{opacity:1}],{duration:420,delay:i*40+160,fill:'forwards'})));
 };
 useEffect(()=>{let alive=true;let timeout;
  if(reduced||compact)return;
  const fit=()=>{if(!alive||!svg.current)return;try{const b=svg.current.getBBox();if(!b.width||!b.height)throw Error('Empty headline');setBox(`${b.x-8} ${b.y-8} ${b.width+16} ${b.height+16}`);}catch{setFailed(true);}};
  timeout=setTimeout(()=>{if(alive)setFailed(true);},1200);
  document.fonts.load('600 100px Poppins').then(()=>{clearTimeout(timeout);fit();}).catch(()=>{clearTimeout(timeout);if(alive)setFailed(true);});
  return()=>{alive=false;clearTimeout(timeout);animations.current.forEach(a=>a.cancel());};
 },[reduced,compact]);
 useEffect(()=>{if(box&&!reduced&&!failed&&!compact){draw(true);setDrawn(true);}},[box,reduced,failed,compact]);
 // The headline is real text from the first paint. The outline version reserves the same space,
 // draws once on top and then the plain copy fades out, so nothing waits for the web font.
 const plain=<div className="tt-headline-plain">Every small act becomes <em>visible</em> care for the sea.</div>;
 return <><h1 className="sr-only">Every small act becomes visible care for the sea.</h1><div className="tt-headline" aria-hidden="true">
 {(reduced||failed||compact)?plain:<><div className={`tt-headline-overlay${drawn?' is-hidden':''}`}>{plain}</div><svg ref={svg} viewBox={box||'-650 -100 1300 350'} style={{visibility:box?'visible':'hidden'}} onPointerEnter={()=>{svg.current.querySelectorAll('.tt-fill-char').forEach(n=>n.style.opacity=1);draw();}}>{lines.map((line,l)=><g key={line}>{['fill','stroke'].map(type=><text key={type} x="0" y={l*116} textAnchor="middle" className={`tt-${type}`}>{[...line].map((ch,i)=><tspan key={i} className={`tt-${type}-char`} style={type==='fill'?{fill:l===1&&i<7?'#CE6D38':'#203463'}:{}}>{ch}</tspan>)}</text>)}</g>)}</svg></>}
 </div></>;
}
