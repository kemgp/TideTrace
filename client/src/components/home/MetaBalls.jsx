import {useEffect,useRef} from 'react';
// Reference-specific two-layer scalar-field metaballs. Canvas lifecycle is owned by React.
export default function MetaBalls({reduced}){
 const host=useRef(null);
 useEffect(()=>{
  if(!window.IntersectionObserver||!window.ResizeObserver)return;
  const card=host.current.parentElement;let frame=0,visible=false,last=0,time=0;const mouse={x:.5,y:.5,inside:false};
  const layers=[...host.current.querySelectorAll('canvas')].map((canvas,i)=>({canvas,ctx:canvas.getContext('2d'),color:i?[255,255,255]:[231,166,110],alpha:i?.34:.55,cx:i?.74:.26,cy:i?.74:.26})).filter(l=>l.ctx);
  const size=()=>{layers.forEach(l=>{l.canvas.width=Math.max(24,Math.round(card.clientWidth/4));l.canvas.height=Math.max(16,Math.round(card.clientHeight/4));l.image=l.ctx.createImageData(l.canvas.width,l.canvas.height);});render();};
  const render=()=>layers.forEach(l=>{
   const w=l.canvas.width,h=l.canvas.height;const balls=Array.from({length:6},(_,i)=>{const seek=i<2&&mouse.inside&&!reduced;return {x:(seek?mouse.x:l.cx)*w+Math.sin(time*(.3+i*.05)+i*1.9)*w*.13,y:(seek?mouse.y:l.cy)*h+Math.cos(time*(.4+i*.03)+i)*h*.22,r:h*(.13+(i%3)*.045)};});
   const data=l.image.data;
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){let field=0;for(const b of balls)field+=b.r*b.r/((x-b.x)**2+(y-b.y)**2+.001);const p=(y*w+x)*4;data[p]=l.color[0];data[p+1]=l.color[1];data[p+2]=l.color[2];data[p+3]=Math.max(0,Math.min(1,(field-.92)/.55))*l.alpha*255;}l.ctx.putImageData(l.image,0,0);
  });
  const tick=now=>{frame=0;if(!visible||document.hidden||reduced)return;time+=last?Math.min((now-last)/1000,.05):0;last=now;render();frame=requestAnimationFrame(tick);};
  const wake=()=>{cancelAnimationFrame(frame);frame=0;last=0;if(visible&&!document.hidden&&!reduced)frame=requestAnimationFrame(tick);};
  const move=e=>{const r=card.getBoundingClientRect();mouse.x=(e.clientX-r.left)/r.width;mouse.y=(e.clientY-r.top)/r.height;mouse.inside=true;};const leave=()=>mouse.inside=false;
  const io=new IntersectionObserver(es=>{visible=es[0].isIntersecting;wake();});io.observe(card);const ro=new ResizeObserver(size);ro.observe(card);size();
  card.addEventListener('pointermove',move);card.addEventListener('pointerleave',leave);document.addEventListener('visibilitychange',wake);
  return()=>{cancelAnimationFrame(frame);io.disconnect();ro.disconnect();card.removeEventListener('pointermove',move);card.removeEventListener('pointerleave',leave);document.removeEventListener('visibilitychange',wake);};
 },[reduced]);
 return <div ref={host} className="tt-metaballs" aria-hidden="true"><canvas/><canvas/></div>;
}
