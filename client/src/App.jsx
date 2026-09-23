import React from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { ROLE_HOME } from "./api/auth.js";
import AuthCallback from "./pages/auth/AuthCallback.jsx";
import { AppProvider, useApp } from "./context/AppContext.jsx";
import { impactStats } from "./data/mockData.js";
import Navbar from "./components/Navbar.jsx";

import Login from "./pages/auth/Login.jsx";
import Register from "./pages/auth/Register.jsx";
import ForgotPassword from "./pages/auth/ForgotPassword.jsx";
import UserDashboard from "./pages/user/Dashboard.jsx";
import ViewTraces from "./pages/user/traces/ViewTraces.jsx";
import ViewTrace from "./pages/user/traces/ViewTrace.jsx";
import UploadTrace from "./pages/user/traces/UploadTrace.jsx";
import MyContributions from "./pages/user/contributions/MyContributions.jsx";
import ViewSubmission from "./pages/user/contributions/ViewSubmission.jsx";
import EditSubmission from "./pages/user/contributions/EditSubmission.jsx";
import Tides from "./pages/user/tides/Tides.jsx";
import ViewTide from "./pages/user/tides/ViewTide.jsx";
import Notifications from "./pages/user/notifications/Notifications.jsx";
import Profile from "./pages/user/profile/Profile.jsx";

import ModDashboard from "./pages/moderator/Dashboard.jsx";
import ReviewTraces from "./pages/moderator/ReviewTraces.jsx";
import ManageComments from "./pages/moderator/ManageComments.jsx";
import ManageReports from "./pages/moderator/ManageReports.jsx";

import AdminDashboard from "./pages/admin/Dashboard.jsx";
import ManageUsers from "./pages/admin/ManageUsers.jsx";
import ManageModerators from "./pages/admin/ManageModerators.jsx";
import ManageTides from "./pages/admin/ManageTides.jsx";
import ManageCategories from "./pages/admin/ManageCategories.jsx";

const WAVE = (
  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
    <path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
    <path d="M2 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
  </svg>
);  

function Home() {
  const navigate = useNavigate();
  return (
    <div className="view-home">
      <header className="hero" id="home-top">
        <div className="wrap hero-grid">
          <div>
            <span className="eyebrow">Community-powered conservation</span>
            <h1>Every small act becomes <em>visible</em> care for the sea.</h1>
            <p className="lead">
              TideTrace turns ordinary sightings, clean-ups, and stories from coastal communities into a
              living archive — closing the gap between people and the crises we're facing, one trace at a time.
            </p>
            <div className="cta-row">
              <button className="btn clay" onClick={() => navigate("/login")}>Start Tracing — it's free</button>
              <a href="#home-how"><button className="btn outline">See how it works</button></a>
            </div>
            <div className="trust">
              <div className="avatar-stack">
                <i style={{ background: "var(--tan)" }} /><i style={{ background: "var(--teal)" }} />
                <i style={{ background: "var(--clay)" }} /><i style={{ background: "var(--blue)" }} />
              </div>
              <span>Joined by coastal communities across the Visayas</span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="device-frame">
              <div className="bar"><span /><span /><span /></div>
              <div className="content">
                <div className="fake-banner">
                  <div className="t">This month's impact</div>
                  <div className="s">Barangay Lawis and neighbors</div>
                </div>
                <div className="fake-stats">
                  <div><b>128</b><span>species</span></div>
                  <div><b>3.2t</b><span>waste rm.</span></div>
                  <div><b>14</b><span>brgy.</span></div>
                  <div><b>640</b><span>mangroves</span></div>
                </div>
                <div className="fake-card">
                  <div className="thumb" style={{ background: "var(--tan)" }} />
                  <div><div className="t">Bleaching patch near Sitio Lawis</div><div className="s">Aling Nena · 2h ago</div></div>
                </div>
                <div className="fake-card">
                  <div className="thumb" style={{ background: "var(--teal)" }} />
                  <div><div className="t">40 new mangrove seedlings</div><div className="s">Brgy. Youth Group · 5h ago</div></div>
                </div>
              </div>
            </div>
            <div className="float-chip c1">
              <div className="ic" style={{ background: "#e2f2f2" }}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#5aa2a8" strokeWidth={2}><path d="M3 12h18M12 3v18" /></svg>
              </div>
              <div><div className="t">New Trace</div><div className="s">just now</div></div>
            </div>
            <div className="float-chip c2">
              <div className="ic" style={{ background: "#fbe7db" }}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#ce6d38" strokeWidth={2}><path d="M20 6 9 17l-5-5" /></svg>
              </div>
              <div><div className="t">Trace verified</div><div className="s">community-checked</div></div>
            </div>
          </div>
        </div>
        <svg className="wave-divider" viewBox="0 0 1440 60" preserveAspectRatio="none">
          <path d="M0 30 Q60 5 120 30 T240 30 T360 30 T480 30 T600 30 T720 30 T840 30 T960 30 T1080 30 T1200 30 T1320 30 T1440 30 V60 H0 Z" fill="#ffffff" />
          <path d="M0 30 Q60 5 120 30 T240 30 T360 30 T480 30 T600 30 T720 30 T840 30 T960 30 T1080 30 T1200 30 T1320 30 T1440 30" stroke="#5aa2a8" strokeWidth={2} fill="none" />
        </svg>
      </header>

      <section className="hsec" id="home-mission">
        <div className="wrap mission-h sh" style={{ marginBottom: 0 }}>
          <span className="tagline">The core question</span>
          <h2>How do we enable people to care more, and do more, <span>for each other and the planet?</span></h2>
          <p>
            Climate change and biodiversity loss aren't the only crises we face — apathy is too. Not because
            people don't care, but because they feel unconnected, powerless, and distant. TideTrace exists to
            close that gap, one small, visible act at a time.
          </p>
        </div>
      </section>

      <section className="hsec bg" id="home-features">
        <div className="wrap">
          <div className="sh">
            <span className="tagline" style={{ color: "var(--clay)" }}>What makes it different</span>
            <h2>Built on people, not just data</h2>
            <p>TideTrace sits at the intersection of citizen science, social participation, and environmental education — rooted in local knowledge.</p>
          </div>
          <div className="pgrid">
            <div className="pillar">
              <div className="ic" style={{ background: "#e2f2f2" }}>
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#5aa2a8" strokeWidth={2}><path d="M12 21c-4-4-8-8.5-8-13a8 8 0 0 1 16 0c0 4.5-4 9-8 13Z" /><circle cx={12} cy={8} r="2.5" /></svg>
              </div>
              <h3>Emotional, not just statistical</h3>
              <p>Centered on belonging and participation — not spreadsheets and charts alone.</p>
            </div>
            <div className="pillar">
              <div className="ic" style={{ background: "#fbe7db" }}>
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#ce6d38" strokeWidth={2}><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 20h16" /></svg>
              </div>
              <h3>Ordinary actions, real impact</h3>
              <p>Storytelling, clean-ups, documentation, and learning — all become ecological contributions.</p>
            </div>
            <div className="pillar">
              <div className="ic" style={{ background: "#e3ecfa" }}>
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#314e9d" strokeWidth={2}><circle cx={12} cy={12} r={9} /><path d="M12 3v18M3 12h18" /></svg>
              </div>
              <h3>Community + technology</h3>
              <p>Citizen science and local ecological knowledge, working together — not replacing one another.</p>
            </div>
            <div className="pillar">
              <div className="ic" style={{ background: "#eaf6e9" }}>
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#5aa2a8" strokeWidth={2}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" /></svg>
              </div>
              <h3>Care that's affordable</h3>
              <p>Care can't be sustained if survival isn't. We build for accessibility and dignity first.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="hsec impact" id="home-impact">
        <div className="wrap">
          <div className="sh">
            <span className="tagline">Real-time impact</span>
            <h2>What the community has already logged</h2>
            <p>Numbers that grow because ordinary people showed up — visualized, visible, and shared.</p>
          </div>
          <div className="igrid">
            {impactStats.map((s) => (
              <div className="istat" key={s.label}><b>{s.value}</b><span>{s.label}</span></div>
            ))}
          </div>
        </div>
      </section>

      <section className="hsec" id="home-how">
        <div className="wrap">
          <div className="sh">
            <span className="tagline" style={{ color: "var(--clay)" }}>Getting started</span>
            <h2>Three steps to your first trace</h2>
          </div>
          <div className="sgrid3">
            <div className="step"><div className="num">1</div><h3>Join your community</h3><p>Sign up and connect to your barangay or coastal community — see what's already been logged nearby.</p></div>
            <div className="step"><div className="num">2</div><h3>Log what you see</h3><p>Snap a photo, record a story, or note a sighting. It takes under a minute to add to the shared archive.</p></div>
            <div className="step"><div className="num">3</div><h3>Watch the impact grow</h3><p>See your contribution join the collective — visualized alongside everyone else's small acts of care.</p></div>
          </div>
        </div>
      </section>

      <section className="hsec quote">
        <div className="wrap">
          <blockquote>"Small acts have large impact. Through many small actions, the collective becomes visible."</blockquote>
          <div className="who">— TideTrace vision statement</div>
        </div>
      </section>

      <section className="hsec">
        <div className="wrap">
          <div className="cta-final">
            <h2>Your first trace takes less than a minute.</h2>
            <p>Join coastal communities already turning ordinary moments into a living archive of the sea.</p>
            <div className="cta-row">
              <button className="btn clay" onClick={() => navigate("/login")}>Start Tracing</button>
              <a href="#home-features"><button className="btn outline" style={{ borderColor: "#fff", color: "#fff" }}>Learn more</button></a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Footer() {
  return (
    <footer>
      <div className="wrap foot-in">
        <div className="foot-main">
          <a className="foot-brand" href="/" aria-label="TideTrace home">
            {WAVE}
            <span>TideTrace</span>
          </a>
          <p className="foot-tagline">Community-powered ecosystem conservation.</p>
        </div>
        <div className="foot-meta">
          <span className="foot-roles">User <i /> Moderator <i /> Admin</span>
          <span className="foot-version">v1.2</span>
        </div>
        <div className="foot-copy">© 2026 TideTrace <span>Every ripple counts.</span></div>
      </div>
    </footer>
  );
}

function Toast() {
  const { toast } = useApp();
  return <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>;
}

const USER_SECTIONS = {
  dashboard: { title: "Your dashboard", description: "A quick view of your community activity." },
  traces: { title: "Community traces", description: "Explore observations shared by coastal communities." },
  tides: { title: "Tides learning", description: "Learn about the ecosystems connected to every tide." },
  contributions: { title: "Your contributions", description: "Review the traces you have shared with the community." },
  notifications: { title: "Notifications", description: "Stay up to date with your TideTrace activity." },
  profile: { title: "Settings", description: "Manage your community profile." },
};

function UserSection({ section }) {
  const { traces, tides, notifications } = useApp();
  const content = USER_SECTIONS[section];
  const userTraces = traces.filter((trace) => trace.author === "Ana Ramos");

  return (
    <section className="page-wrap">
      <div className="sh">
        <span className="tagline">TideTrace community</span>
        <h1>{content.title}</h1>
        <p>{content.description}</p>
      </div>

      {section === "dashboard" && (
        <div className="igrid">
          <div className="istat"><b>{userTraces.length}</b><span>Your traces</span></div>
          <div className="istat"><b>{userTraces.filter((trace) => trace.status === "approved").length}</b><span>Approved</span></div>
          <div className="istat"><b>{tides.filter((tide) => tide.progress === 100).length}</b><span>Lessons completed</span></div>
          <div className="istat"><b>{notifications.filter((notification) => notification.unread).length}</b><span>Unread updates</span></div>
        </div>
      )}

      {section === "traces" && <div className="pgrid">{traces.map((trace) => <TraceCard key={trace.id} trace={trace} />)}</div>}
      {section === "tides" && <div className="pgrid">{tides.map((tide) => <TideCard key={tide.id} tide={tide} />)}</div>}
      {section === "contributions" && <div className="pgrid">{userTraces.map((trace) => <TraceCard key={trace.id} trace={trace} />)}</div>}
      {section === "notifications" && (
        <div className="stack-list">
          {notifications.map((notification) => <div className="list-row" key={notification.id}><b>{notification.text}</b><span>{notification.when}</span></div>)}
        </div>
      )}
      {section === "profile" && (
        <div className="auth-card profile-panel">
          <h2>Ana Ramos</h2>
          <p>ana@tidetrace.app</p>
          <p>Brgy. Lawis community member</p>
        </div>
      )}
    </section>
  );
}

function SessionGate({ children }) {
  const { role, sessionReady, sessionError, retrySession, clearSession } = useApp();
  if (!sessionReady) return <div className="wrap" role="status">Restoring your session…</div>;
  if (!role && sessionError) return <div className="wrap">
    <p role="alert">{sessionError}</p>
    <button className="btn blue" onClick={retrySession}>Retry connection</button>
    <button className="btn ghost" onClick={() => clearSession()}>Back to log in</button>
  </div>;
  return children;
}

function RequireRole({ role: required, children }) {
  const { role } = useApp();
  return <SessionGate>{role !== required ? <Navigate to={ROLE_HOME[role] || "/login"} replace /> : children}</SessionGate>;
}

function AppShell() {
  const { role, profile, sessionError, sessionNotice, retrySession } = useApp();
  const location = useLocation();
  if (location.pathname !== "/auth/callback" && /(?:^#|&)(access_token|error_code|error)=/.test(location.hash)) {
    return <Navigate to={{ pathname: "/auth/callback", hash: location.hash }} replace />;
  }
  return (
    <div className="app-shell">
      <Navbar />
      {sessionNotice && <div className="demo-notice" role="status">{sessionNotice}</div>}
      {role && sessionError && <div className="demo-notice" role="status">{sessionError} <button className="btn ghost sm" onClick={retrySession}>Retry connection</button></div>}
      {role && <div className="demo-notice">Signed in as {profile.display_name}. Traces and My Contributions display saved records. Dashboards and other actions are still demos; changes there are not saved.</div>}
      <main>
        <Routes>
          <Route path="/" element={<div className="view"><Home /></div>} />
          <Route path="/login" element={<SessionGate><Login /></SessionGate>} />
          <Route path="/register" element={<SessionGate><Register /></SessionGate>} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          <Route path="/user" element={<RequireRole role="user"><div className="view"><UserDashboard /></div></RequireRole>} />
          <Route path="/user/dashboard" element={<RequireRole role="user"><div className="view"><UserDashboard /></div></RequireRole>} />
          <Route path="/user/traces" element={<RequireRole role="user"><div className="view"><ViewTraces /></div></RequireRole>} />
          <Route path="/user/traces/upload" element={<RequireRole role="user"><div className="view"><UploadTrace /></div></RequireRole>} />
          <Route path="/user/traces/:id" element={<RequireRole role="user"><div className="view"><ViewTrace /></div></RequireRole>} />
          <Route path="/user/contributions" element={<RequireRole role="user"><div className="view"><MyContributions /></div></RequireRole>} />
          <Route path="/user/contributions/:id/edit" element={<RequireRole role="user"><div className="view"><EditSubmission /></div></RequireRole>} />
          <Route path="/user/contributions/:id" element={<RequireRole role="user"><div className="view"><ViewSubmission /></div></RequireRole>} />
          <Route path="/user/tides" element={<RequireRole role="user"><div className="view"><Tides /></div></RequireRole>} />
          <Route path="/user/tides/:id" element={<RequireRole role="user"><div className="view"><ViewTide /></div></RequireRole>} />
          <Route path="/user/notifications" element={<RequireRole role="user"><div className="view"><Notifications /></div></RequireRole>} />
          <Route path="/user/profile" element={<RequireRole role="user"><div className="view"><Profile /></div></RequireRole>} />

          <Route path="/moderator/dashboard" element={<RequireRole role="mod"><div className="view"><ModDashboard /></div></RequireRole>} />
          <Route path="/moderator/review" element={<RequireRole role="mod"><div className="view"><ReviewTraces /></div></RequireRole>} />
          <Route path="/moderator/comments" element={<RequireRole role="mod"><div className="view"><ManageComments /></div></RequireRole>} />
          <Route path="/moderator/reports" element={<RequireRole role="mod"><div className="view"><ManageReports /></div></RequireRole>} />

          <Route path="/admin/dashboard" element={<RequireRole role="admin"><div className="view"><AdminDashboard /></div></RequireRole>} />
          <Route path="/admin/users" element={<RequireRole role="admin"><div className="view"><ManageUsers /></div></RequireRole>} />
          <Route path="/admin/moderators" element={<RequireRole role="admin"><div className="view"><ManageModerators /></div></RequireRole>} />
          <Route path="/admin/tides" element={<RequireRole role="admin"><div className="view"><ManageTides /></div></RequireRole>} />
          <Route path="/admin/categories" element={<RequireRole role="admin"><div className="view"><ManageCategories /></div></RequireRole>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
