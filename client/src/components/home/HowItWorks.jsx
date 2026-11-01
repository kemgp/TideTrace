import {useRef} from 'react';
import {useInView} from './motion.js';
const steps=[
 ['Join your community',"Sign up and connect to your barangay or coastal community — see what's already been logged nearby."],
 ['Log what you see','Snap a photo, record a story, or note a sighting. It takes under a minute to add to the shared archive.'],
 ['Watch the impact grow',"See your contribution join the collective — visualized alongside everyone else's small acts of care."],
];
export default function HowItWorks(){
 const grid=useRef(null);
 const drawn=useInView(grid);
 return (
      <section className="tt-hsec tt-edge tt-edge-white" id="home-how">
        <div className="tt-wrap">
          <div className="tt-sh">
            <span className="tt-tagline" style={{color:"var(--clay-strong)"}}>Getting started</span>
            <h2>Three steps to your first trace</h2>
          </div>
          <div className={`tt-sgrid3${drawn?' is-drawn':''}`} ref={grid}>
            {steps.map(([title,text],i)=>(
              <div className="tt-step" key={title} style={{'--step':i}}>
                <div className="tt-num">{i+1}</div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
);}
