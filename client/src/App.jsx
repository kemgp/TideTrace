import Home from "./pages/Home/index.jsx";
import LegalPage from "./pages/legal/LegalPage.jsx";
import PageMetadata from "./components/PageMetadata.jsx";
import React,{useEffect,useState} from "react";
import {Link,Navigate,Route,Routes,useLocation} from "react-router-dom";
import {ROLE_HOME} from "./api/auth.js";
import AuthCallback from "./pages/auth/AuthCallback.jsx";
import {AppProvider,useApp} from "./context/AppContext.jsx";
import Navbar from "./components/Navbar.jsx";
import PublicNavbar from "./components/home/PublicNavbar.jsx";
import SkeletonLoader from "./components/SkeletonLoader.jsx";
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
import ModAnalytics from "./pages/moderator/Analytics.jsx";
import "./pages/moderator/moderator.css";
import "./pages/user/user.css";
import ModDashboard from "./pages/moderator/Dashboard.jsx";
import ReviewTraces,{ModerationHistory} from "./pages/moderator/ReviewTraces.jsx";
import ManageComments from "./pages/moderator/ManageComments.jsx";
import ManageReports from "./pages/moderator/ManageReports.jsx";
import ModeratorProfile from "./pages/moderator/Profile";
import AdminDashboard from "./pages/admin/Dashboard.jsx";
import ManageUsers from "./pages/admin/ManageUsers.jsx";
import ManageModerators from "./pages/admin/ManageModerators.jsx";
import EditTide from "./pages/admin/EditTide.jsx";
import ManageTides from "./pages/admin/ManageTides.jsx";
import ManageCategories from "./pages/admin/ManageCategories.jsx";
import AdminProfile from "./pages/admin/Profile";
import AdminSettings from "./pages/admin/Settings.jsx";
import AdminAnalytics from "./pages/admin/Analytics.jsx";
import AdminHistory from "./pages/admin/History.jsx";
import "./pages/admin/admin.css";
const WAVE=(
  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
    <path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/>
    <path d="M2 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/>
  </svg>
);
function Footer(){
  return(
    <footer>
      <div className="wrap foot-in">
        <div className="foot-main">
          <a className="foot-brand" href="/" aria-label="TideTrace home">
            {WAVE}
            <span>TideTrace</span>
          </a>
          <p className="foot-tagline">Community-powered ecosystem conservation.</p>
        </div>
        <div className="foot-details">
          <nav className="foot-legal" aria-label="Legal"><Link to="/terms-of-service">Terms of Service</Link><Link to="/privacy-policy">Privacy Policy</Link></nav>
          <div className="foot-copy">
            © 2026 TideTrace <span>Every ripple counts.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
function Toast(){
  const {toast}=useApp();
  return <div className={`toast ${toast?"show":""}`}>{toast}</div>;
}
const USER_SECTIONS={
  dashboard:{
    title:"Your dashboard",
    description:"A quick view of your community activity."
  },
  traces:{
    title:"Community traces",
    description:"Explore observations shared by coastal communities."
  },
  tides:{
    title:"Tides learning",
    description:"Learn about the ecosystems connected to every tide."
  },
  contributions:{
    title:"Your contributions",
    description:"Review the traces you have shared with the community."
  },
  notifications:{
    title:"Notifications",
    description:"Stay up to date with your TideTrace activity."
  },
  profile:{
    title:"Settings",
    description:"Manage your community profile."
  },
};
function UserSection({section}){
  const {traces,tides,notifications}=useApp();
  const content=USER_SECTIONS[section];
  const userTraces=traces.filter((trace)=>trace.author==="Ana Ramos");
  return(
    <section className="page-wrap">
      <div className="sh">
        <span className="tagline">TideTrace community</span>
        <h1>{content.title}</h1>
        <p>{content.description}</p>
      </div>
      {section==="dashboard"&&(
        <div className="igrid">
          <div className="istat">
            <b>{userTraces.length}</b>
            <span>Your traces</span>
          </div>
          <div className="istat">
            <b>{userTraces.filter((trace)=>trace.status==="approved").length}</b>
            <span>Approved</span>
          </div>
          <div className="istat">
            <b>{tides.filter((tide)=>tide.progress===100).length}</b>
            <span>Lessons completed</span>
          </div>
          <div className="istat">
            <b>{notifications.filter((notification)=>notification.unread).length}</b>
            <span>Unread updates</span>
          </div>
        </div>
      )}
      {section==="traces"&&(
        <div className="pgrid">
          {traces.map((trace)=>(
            <TraceCard key={trace.id} trace={trace}/>
          ))}
        </div>
      )}
      {section==="tides"&&(
        <div className="pgrid">
          {tides.map((tide)=>(
            <TideCard key={tide.id} tide={tide}/>
          ))}
        </div>
      )}
      {section==="contributions"&&(
        <div className="pgrid">
          {userTraces.map((trace)=>(
            <TraceCard key={trace.id} trace={trace}/>
          ))}
        </div>
      )}
      {section==="notifications"&&(
        <div className="stack-list">
          {notifications.map((notification)=>(
            <div className="list-row" key={notification.id}>
              <b>{notification.text}</b>
              <span>{notification.when}</span>
            </div>
          ))}
        </div>
      )}
      {section==="profile"&&(
        <div className="auth-card profile-panel">
          <h2>Ana Ramos</h2>
          <p>ana@tidetrace.app</p>
          <p>Brgy. Lawis community member</p>
        </div>
      )}
    </section>
  );
}
function SessionGate({children}){
  const {
    role,
    sessionReady,
    sessionError,
    retrySession,
    clearSession
  }=useApp();
  if(!sessionReady){
    return(
      <div className="wrap" role="status">
        Restoring your session…
      </div>
    );
  }
  if(!role&&sessionError){
    return(
      <div className="wrap">
        <p role="alert">{sessionError}</p>
        <button className="btn blue" onClick={retrySession}>
          Retry connection
        </button>
        <button className="btn ghost" onClick={()=>clearSession()}>
          Back to log in
        </button>
      </div>
    );
  }
  return children;
}
function RequireRole({role:required,children}){
  const {role}=useApp();
  return(
    <SessionGate>
      {role!==required
        ?<Navigate to={ROLE_HOME[role]||"/login"} replace/>
        :children
      }
    </SessionGate>
  );
}
function AppShell(){
  const {
    role,
    profile,
    sessionError,
    sessionNotice,
    retrySession
  }=useApp();
  const location=useLocation();
  // Keep the skeleton visible immediately on navigation, including the first
  // render of the destination route. Pages stay mounted to fetch their data.
  const [loadedPath,setLoadedPath]=useState(null);
  const pagePath=location.pathname;
  const loadingPage=Boolean(role)&&loadedPath!==pagePath;
  useEffect(()=>{
    if(!role){
      setLoadedPath(null);
      return;
    }
    const timer=window.setTimeout(()=>setLoadedPath(pagePath),650);
    return ()=>window.clearTimeout(timer);
  },[pagePath,role]);
  if(
    location.pathname!=="/auth/callback"&&
    /(?:^#|&)(access_token|error_code|error)=/.test(location.hash)
  ){
    return(
      <Navigate
        to={{
          pathname:"/auth/callback",
          hash:location.hash
        }}
        replace
      />
    );
  }
  if(location.pathname === "/") return <div className="app-shell"><Home/><Footer/><Toast/></div>;
  return(
    <div
      className={`app-shell ${
        role==="admin"
          ?"admin-shell"
          :role==="mod"
            ?"moderator-shell"
            :role==="user"
              ?"user-shell"
              :""
      }`}
    >
      {!role && ["/login", "/register", "/forgot-password", "/auth/callback"].includes(location.pathname)
        ? <PublicNavbar />
        : <Navbar />}
        {loadingPage&&<SkeletonLoader path={pagePath}/>}
      {sessionNotice&&(
        <div className="demo-notice" role="status">
          {sessionNotice}
        </div>
      )}
      {role&&sessionError&&(
        <div className="demo-notice" role="status">
          {sessionError}{" "}
          <button
            className="btn ghost sm"
            onClick={retrySession}
          >
            Retry connection
          </button>
        </div>
      )}
      <main>
          <Routes>
            <Route path="/terms-of-service" element={<LegalPage document="terms" />} />
            <Route path="/privacy-policy" element={<LegalPage document="privacy" />} />
            <Route
              path="/"
              element={
                <Home/>
              }
            />
            <Route
              path="/login"
              element={
                <SessionGate>
                  <Login/>
                </SessionGate>
              }
            />
            <Route
              path="/register"
              element={
                <SessionGate>
                  <Register/>
                </SessionGate>
              }
            />
            <Route
              path="/auth/callback"
              element={<AuthCallback/>}
            />
            <Route
              path="/forgot-password"
              element={<ForgotPassword/>}
            />
            {/* USER */}
            <Route
              path="/user"
              element={
                <RequireRole role="user">
                  <div className="view">
                    <UserDashboard/>
                  </div>
                </RequireRole>
              }
            />
            <Route
              path="/user/dashboard"
              element={
                <RequireRole role="user">
                  <div className="view">
                    <UserDashboard/>
                  </div>
                </RequireRole>
              }
            />
            <Route
              path="/user/traces"
              element={
                <RequireRole role="user">
                  <div className="view">
                    <ViewTraces/>
                  </div>
                </RequireRole>
              }
            />
            <Route
              path="/user/traces/upload"
              element={
                <RequireRole role="user">
                  <div className="view">
                    <UploadTrace/>
                  </div>
                </RequireRole>
              }
            />
            <Route
              path="/user/traces/:id"
              element={
                <RequireRole role="user">
                  <div className="view">
                    <ViewTrace/>
                  </div>
                </RequireRole>
              }
            />
            <Route
              path="/user/contributions"
              element={
                <RequireRole role="user">
                  <div className="view">
                    <MyContributions/>
                  </div>
                </RequireRole>
              }
            />
            <Route
              path="/user/contributions/:id/edit"
              element={
                <RequireRole role="user">
                  <div className="view">
                    <EditSubmission/>
                  </div>
                </RequireRole>
              }
            />
            <Route
              path="/user/contributions/:id"
              element={
                <RequireRole role="user">
                  <div className="view">
                    <ViewSubmission/>
                  </div>
                </RequireRole>
              }
            />
            <Route
              path="/user/tides"
              element={
                <RequireRole role="user">
                  <div className="view">
                    <Tides/>
                  </div>
                </RequireRole>
              }
            />
            <Route
              path="/user/tides/:id"
              element={
                <RequireRole role="user">
                  <div className="view">
                    <ViewTide/>
                  </div>
                </RequireRole>
              }
            />
            <Route
              path="/user/notifications"
              element={
                <RequireRole role="user">
                  <div className="view">
                    <Notifications/>
                  </div>
                </RequireRole>
              }
            />
            <Route
              path="/user/profile"
              element={
                <RequireRole role="user">
                  <div className="view">
                    <Profile/>
                  </div>
                </RequireRole>
              }
            />
            {/* MODERATOR */}
            <Route
              path="/moderator/dashboard"
              element={
                <RequireRole role="mod">
                  <div className="view">
                    <ModDashboard/>
                  </div>
                </RequireRole>
              }
            />
            <Route
              path="/moderator/review"
              element={
                <RequireRole role="mod">
                  <div className="view">
                    <ReviewTraces/>
                  </div>
                </RequireRole>
              }
            />
            <Route
              path="/moderator/review/history"
              element={
                <RequireRole role="mod">
                  <div className="view">
                    <ModerationHistory/>
                  </div>
                </RequireRole>
              }
            />
            <Route
              path="/moderator/review/:id"
              element={
                <RequireRole role="mod">
                  <div className="view">
                    <ReviewTraces/>
                  </div>
                </RequireRole>
              }
            />
            <Route
              path="/moderator/analytics"
              element={
                <RequireRole role="mod">
                  <div className="view">
                    <ModAnalytics/>
                  </div>
                </RequireRole>
              }
            />
            <Route
              path="/moderator/comments"
              element={
                <RequireRole role="mod">
                  <div className="view">
                    <ManageComments/>
                  </div>
                </RequireRole>
              }
            />
            <Route
              path="/moderator/reports"
              element={
                <RequireRole role="mod">
                  <div className="view">
                    <ManageReports/>
                  </div>
                </RequireRole>
              }
            />
            <Route
              path="/moderator/profile"
              element={
                <RequireRole role="mod">
                  <ModeratorProfile/>
                </RequireRole>
              }
            />
            {/* ADMIN */}
            <Route
              path="/admin/dashboard"
              element={
                <RequireRole role="admin">
                  <div className="view">
                    <AdminDashboard/>
                  </div>
                </RequireRole>
              }
            />
            <Route
              path="/admin/users"
              element={
                <RequireRole role="admin">
                  <div className="view">
                    <ManageUsers/>
                  </div>
                </RequireRole>
              }
            />
            <Route
              path="/admin/moderators"
              element={
                <RequireRole role="admin">
                  <div className="view">
                    <ManageModerators/>
                  </div>
                </RequireRole>
              }
            />
            <Route
              path="/admin/tides"
              element={
                <RequireRole role="admin">
                  <div className="view">
                    <ManageTides/>
                  </div>
                </RequireRole>
              }
            />
            <Route
              path="/admin/tides/new"
              element={
                <RequireRole role="admin">
                  <div className="view">
                    <EditTide/>
                  </div>
                </RequireRole>
              }
            />
            <Route
              path="/admin/tides/:id/edit"
              element={
                <RequireRole role="admin">
                  <div className="view">
                    <EditTide/>
                  </div>
                </RequireRole>
              }
            />
            <Route
              path="/admin/categories"
              element={
                <RequireRole role="admin">
                  <div className="view">
                    <ManageCategories/>
                  </div>
                </RequireRole>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <RequireRole role="admin">
                  <div className="view">
                    <AdminSettings/>
                  </div>
                </RequireRole>
              }
            />
            <Route
              path="/admin/analytics"
              element={
                <RequireRole role="admin">
                  <div className="view">
                    <AdminAnalytics/>
                  </div>
                </RequireRole>
              }
            />
            <Route
              path="/admin/profile"
              element={
                <RequireRole role="admin">
                  <AdminProfile/>
                </RequireRole>
              }
            />
            <Route
              path="/admin/review"
              element={
                <RequireRole role="admin">
                  <div className="view">
                    <ReviewTraces/>
                  </div>
                </RequireRole>
              }
            />
            <Route
              path="/admin/review/history"
              element={
                <RequireRole role="admin">
                  <div className="view">
                    <AdminHistory/>
                  </div>
                </RequireRole>
              }
            />
            <Route
              path="/admin/review/:id"
              element={
                <RequireRole role="admin">
                  <div className="view">
                    <ReviewTraces/>
                  </div>
                </RequireRole>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <RequireRole role="admin">
                  <div className="view">
                    <ManageReports/>
                  </div>
                </RequireRole>
              }
            />
            <Route
              path="*"
              element={<Navigate to="/" replace/>}
            />
          </Routes>
      </main>
      <Footer/>
      <Toast/>
    </div>
  );
}
export default function App(){
  return(
    <AppProvider>
      <PageMetadata/>
      <AppShell/>
    </AppProvider>
  );
}
