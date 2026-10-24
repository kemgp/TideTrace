import SpotlightCard from "./reactbits/SpotlightCard.jsx";
export default function Features(){return (
      <section className="tt-hsec tt-bg" id="home-features">
        <div className="tt-wrap">
          <div className="tt-sh">
            <span className="tt-tagline" style={{color:"var(--clay)"}}>What makes it different</span>
            <h2>Built on people, not just data</h2>
            <p>
              TideTrace sits at the intersection of citizen science, social participation, and environmental
              education. It is rooted in local knowledge.
            </p>
          </div>
          <div className="tt-pgrid">
            <SpotlightCard className="tt-pillar" spotlightColor="#5AA2A8" intensity={0.16} spotlightSize={240} proximity={0} flare={false} borderGlow={0} style={{"--spotlight-card-surface":"#fff"}}>
              <div className="tt-ic" style={{background:"#e2f2f2"}}>
                <svg aria-hidden="true" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#5aa2a8" strokeWidth={2}>
                  <path d="M12 21c-4-4-8-8.5-8-13a8 8 0 0 1 16 0c0 4.5-4 9-8 13Z"/>
                  <circle cx={12} cy={8} r="2.5"/>
                </svg>
              </div>
              <h3>Emotional, not just statistical</h3>
              <p>Centered on belonging and participation, not spreadsheets and charts alone.</p>
            </SpotlightCard>
            <SpotlightCard className="tt-pillar" spotlightColor="#5AA2A8" intensity={0.16} spotlightSize={240} proximity={0} flare={false} borderGlow={0} style={{"--spotlight-card-surface":"#fff"}}>
              <div className="tt-ic" style={{background:"#fbe7db"}}>
                <svg aria-hidden="true" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#ce6d38" strokeWidth={2}>
                  <path d="M12 16V4M7 9l5-5 5 5"/>
                  <path d="M4 20h16"/>
                </svg>
              </div>
              <h3>Ordinary actions, real impact</h3>
              <p>Storytelling, clean-ups, documentation, and learning. They all become ecological contributions.</p>
            </SpotlightCard>
            <SpotlightCard className="tt-pillar" spotlightColor="#5AA2A8" intensity={0.16} spotlightSize={240} proximity={0} flare={false} borderGlow={0} style={{"--spotlight-card-surface":"#fff"}}>
              <div className="tt-ic" style={{background:"#e3ecfa"}}>
                <svg aria-hidden="true" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#314e9d" strokeWidth={2}>
                  <circle cx={12} cy={12} r={9}/>
                  <path d="M12 3v18M3 12h18"/>
                </svg>
              </div>
              <h3>Community + technology</h3>
              <p>Citizen science and local ecological knowledge, working together. Not replacing one another.</p>
            </SpotlightCard>
            <SpotlightCard className="tt-pillar" spotlightColor="#5AA2A8" intensity={0.16} spotlightSize={240} proximity={0} flare={false} borderGlow={0} style={{"--spotlight-card-surface":"#fff"}}>
              <div className="tt-ic" style={{background:"#eaf6e9"}}>
                <svg aria-hidden="true" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#5aa2a8" strokeWidth={2}>
                  <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/>
                </svg>
              </div>
              <h3>Care that's affordable</h3>
              <p>Care can't be sustained if survival isn't. We build for accessibility and dignity first.</p>
            </SpotlightCard>
          </div>
        </div>
      </section>
);}
