import React,{useEffect,useRef,useState} from "react";
import {Link,useLocation,useNavigate} from "react-router-dom";
import {useApp} from "../context/AppContext.jsx";

import AdminIcon from "./AdminIcon.jsx";

const WAVE=(
  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
    <path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/>
    <path d="M2 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/>
  </svg>
);

const userLinks=[
  {to:"/user/dashboard",label:"Dashboard",icon:"dashboard"},
  {to:"/user/traces",label:"Traces",icon:"pin"},
  {to:"/user/tides",label:"Tides",icon:"book"},
  {to:"/user/contributions",label:"Contributions",icon:"log"},
  {to:"/user/notifications",label:"Notifications",icon:"bell"},
  {to:"/user/profile",label:"Settings",icon:"settings"},
];

const modLinks=[
  {to:"/moderator/dashboard",label:"Dashboard",icon:"dashboard"},
  {to:"/moderator/review",label:"Review Traces",icon:"review"},
  {to:"/moderator/comments",label:"Comments",icon:"comment"},
  {to:"/moderator/reports",label:"Reports",icon:"flag"},
  {to:"/moderator/analytics",label:"Analytics",icon:"chart"},
];

const adminLinks=[
  {to:"/admin/dashboard",label:"Dashboard",icon:"dashboard"},
  {to:"/admin/users",label:"Users",icon:"users"},
  {to:"/admin/moderators",label:"Moderators",icon:"shield"},
  {to:"/admin/tides",label:"Content",icon:"book"},
  {to:"/admin/review/history",label:"History",icon:"history"},
  {to:"/admin/settings",label:"Settings",icon:"settings"},
  {to:"/admin/analytics",label:"Analytics",icon:"chart"},
];

export default function Navbar(){
  const {role,profile,logout,unreadNotificationCount,darkMode,setDarkMode}=useApp();
  const location=useLocation();
  const navigate=useNavigate();
  const [open,setOpen]=useState(false);
  const navRef=useRef(null);
  const menuRef=useRef(null);

  useEffect(()=>{
    setOpen(false);
  },[location.pathname,location.hash,role]);

  useEffect(()=>{
    if(!open)return;

    const dismiss=(event)=>{
      if(event.key==="Escape"){
        setOpen(false);
        menuRef.current?.focus();
      }
    };

    const outside=(event)=>{
      if(!navRef.current?.contains(event.target))setOpen(false);
    };

    document.addEventListener("keydown",dismiss);
    document.addEventListener("pointerdown",outside);

    return()=>{
      document.removeEventListener("keydown",dismiss);
      document.removeEventListener("pointerdown",outside);
    };
  },[open]);

  useEffect(()=>{
    if(!window.matchMedia)return;

    const desktop=window.matchMedia("(min-width:1280px)");

    const closeOnDesktop=()=>{
      if(desktop.matches)setOpen(false);
    };

    desktop.addEventListener("change",closeOnDesktop);

    return()=>desktop.removeEventListener("change",closeOnDesktop);
  },[]);

  const links=role==="mod"?modLinks:role==="admin"?adminLinks:role==="user"?userLinks:[];
  const unread=unreadNotificationCount;
  const isAuthPage=["/login","/register","/forgot-password"].includes(location.pathname);
  const avatarClass=role==="mod"?"avatar-btn mod":role==="admin"?"avatar-btn admin":"avatar-btn";
  const avatarLetter=profile?.display_name?.trim().charAt(0).toUpperCase()||"?";
  const homeLink=role==="mod"?"/moderator/dashboard":role==="admin"?"/admin/dashboard":role==="user"?"/user/dashboard":"/";

  const isActive=(link)=>{
    const path=location.pathname;

    if(path===link.to)return true;

    if(role==="mod"){
      return link.to==="/moderator/review"&&path.startsWith("/moderator/review/");
    }

    if(role==="user"){
      return path.startsWith(`${link.to}/`)||(link.to==="/user/dashboard"&&path==="/user");
    }

    if(role!=="admin")return false;

    if(link.label==="Content"){
      return path.startsWith("/admin/tides/")||path==="/admin/categories";
    }

    if(link.label==="History"){
      return path.startsWith("/admin/review")||path==="/admin/reports";
    }

    return false;
  };

  const profilePath=role==="admin"?"/admin/profile":role==="mod"?"/moderator/profile":"/user/profile";

  return(
    <nav ref={navRef} className={`nav ${open?"open":""}`} aria-label="Main navigation">

      <div className="wrap nav-grid">

        <Link
          className="brand"
          to={homeLink}
          onClick={()=>setOpen(false)}
        >
          {WAVE}
          <span>TideTrace</span>
        </Link>

        <div className="nav-right">

          {role&&(
            <>
              <button
                type="button"
                className={avatarClass}
                title="Profile Settings"
                aria-label="Profile settings"
                onClick={()=>{
                  setOpen(false);
                  navigate(profilePath);
                }}
              >
                {avatarLetter}
              </button>

              <div className="navbar-dark-mode">
                <button
                  type="button"
                  className={`dark-mode-switch ${darkMode?"on":""}`}
                  onClick={()=>setDarkMode(!darkMode)}
                  aria-label={darkMode?"Turn off dark mode":"Turn on dark mode"}
                  aria-pressed={darkMode}
                >
                  <span className="dark-mode-circle">
                    {darkMode?"☀":"☾"}
                  </span>
                </button>
              </div>
            </>
          )}

          <button
            ref={menuRef}
            type="button"
            className="menu-btn"
            aria-label="Menu"
            aria-controls="main-navigation-panel"
            aria-expanded={open}
            onClick={()=>setOpen(previous=>!previous)}
          >
            <svg
              aria-hidden="true"
              width={22}
              height={22}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                d={open?"M6 6l12 12M6 18 18 6":"M3 6h18M3 12h18M3 18h18"}
              />
            </svg>
          </button>

        </div>

        <div
          id="main-navigation-panel"
          className="nav-panel"
          onClick={event=>{
            if(event.target.closest("a"))setOpen(false);
          }}
        >

          {role?(
            <ul className="nav-links">

              {links.map(link=>(
                <li key={link.to}>

                  <Link
                    aria-label={
                      link.label==="Notifications"&&unread>0
                        ?`Notifications (${unread} unread)`
                        :undefined
                    }
                    aria-current={isActive(link)?"page":undefined}
                    className={isActive(link)?"on":""}
                    to={link.to}
                  >

                    {link.icon&&(
                      <AdminIcon
                        name={link.icon}
                        size={16}
                      />
                    )}

                    {link.label}

                    {link.label==="Notifications"&&unread>0&&(
                      <span className="nav-badge">
                        {unread}
                      </span>
                    )}

                  </Link>

                </li>
              ))}

            </ul>
          ):(
            <ul className="nav-links">

              {[
                ["home-mission","Our Mission"],
                ["home-features","Features"],
                ["home-impact","Impact"],
                ["home-how","How it Works"]
              ].map(([id,label])=>(
                <li key={id}>
                  {isAuthPage
                    ?<Link to={`/#${id}`}>{label}</Link>
                    :<a href={`#${id}`}>{label}</a>
                  }
                </li>
              ))}

            </ul>
          )}

          <div className="nav-actions">

            {role?(
              <>

                {role!=="user"&&(
                  <span
                    className="role-tag"
                    style={{
                      background:role==="mod"
                        ?"var(--teal)"
                        :"var(--blue)"
                    }}
                  >
                    {role==="mod"?"Moderator":"Admin"}
                  </span>
                )}

                {role==="user"&&(
                  <button
                    type="button"
                    className="btn ghost sm nav-profile"
                    onClick={()=>{
                      setOpen(false);
                      navigate(profilePath);
                    }}
                  >
                    Change profile
                  </button>
                )}

                <button
                  type="button"
                  className="btn ghost sm nav-logout"
                  onClick={()=>{
                    setOpen(false);
                    logout();
                    navigate("/login",{replace:true});
                  }}
                >
                  Log out
                </button>

              </>
            ):(
              <>

                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={()=>{
                    setOpen(false);
                    navigate("/login");
                  }}
                >
                  Log in
                </button>

                <button
                  type="button"
                  className="btn clay sm"
                  onClick={()=>{
                    setOpen(false);
                    navigate("/register");
                  }}
                >
                  Join TideTrace
                </button>

              </>
            )}

          </div>

        </div>

      </div>

    </nav>
  );
}