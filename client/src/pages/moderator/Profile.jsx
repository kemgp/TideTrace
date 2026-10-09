import React,{useState} from "react";
import {Link} from "react-router-dom";
import ProfileNameForm from "../../components/ProfileNameForm.jsx";
import {useApp} from "../../context/AppContext.jsx";
export default function ModeratorProfile(){
  const {
    profile,
    darkMode,
    setDarkMode
  }=useApp();
  const [activeTab,setActiveTab]=useState("account");
  const name=profile?.display_name||"";
  const email=profile?.email||"";
  const profilePhoto="";
  return(
    <main className="settings-page">
      <style>{`
        .moderator-account-view .moderator-account-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:30px;margin-top:24px}
        .moderator-account-view .moderator-account-info,.moderator-account-view .moderator-permissions{min-width:0;border:1px solid #d2e1f3;border-radius:12px;padding:18px;background:var(--card,#fff)}
        .moderator-account-view .moderator-profile-card{border:0;border-bottom:1px solid #e3ebf5;border-radius:0;padding:0 8px 24px;margin-bottom:10px;box-shadow:none;text-align:center;background:transparent}
        .moderator-account-view .moderator-avatar{position:relative;width:104px;height:104px;margin:0 auto 12px;display:flex;align-items:center;justify-content:center}
        .moderator-account-view .moderator-avatar>svg{width:104px;height:104px}
        .moderator-account-view .moderator-avatar .camera-icon{position:absolute;right:0;bottom:1px}
        .moderator-account-view .account-detail{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 0;border-bottom:1px solid #e3ebf5}
        .moderator-account-view .account-detail:last-child{border-bottom:0}
        .moderator-account-view .account-detail>span{color:#6380ad;font-size:12px;font-weight:700;letter-spacing:.04em}
        .moderator-account-view .account-detail>strong{color:#173665;text-align:right;font-size:15px}
        .moderator-account-view .account-detail .status-active{color:#14945e}
        .moderator-account-view .moderator-permissions>h3{margin:3px 0 18px;font-size:18px;color:#183b70}
        .moderator-account-view .permission-list{margin:0}
        html.dark-mode .moderator-account-view .moderator-account-info,html.dark-mode .moderator-account-view .moderator-permissions{background:#172235;border-color:#34445d}
        html.dark-mode .moderator-account-view .moderator-profile-card,html.dark-mode .moderator-account-view .account-detail{border-color:#34445d}
        html.dark-mode .moderator-account-view .account-detail>strong,html.dark-mode .moderator-account-view .moderator-permissions>h3{color:#e7eef7}
        html.dark-mode .moderator-account-view .account-detail .status-active{color:#55cca0}
        @media(max-width:850px){.moderator-account-view .moderator-account-grid{grid-template-columns:1fr}}
      `}</style>
      <div className="settings-container">
        <div className="settings-title">
          <span>SETTINGS</span>
          <h1>Account & preferences</h1>
        </div>
        <div className="settings-layout">
          {/* SIDEBAR */}
          <aside className="settings-sidebar">
            <button
              type="button"
              className={`settings-menu ${
                activeTab==="account"?"active":""
              }`}
              onClick={()=>setActiveTab("account")}
            >
              <span>♟</span>
              Account
            </button>
            <button
              type="button"
              className={`settings-menu ${
                activeTab==="basic"?"active":""
              }`}
              onClick={()=>setActiveTab("basic")}
            >
              <span>👤</span>
              Basic information
            </button>
            <button
              type="button"
              className={`settings-menu ${
                activeTab==="security"?"active":""
              }`}
              onClick={()=>setActiveTab("security")}
            >
              <span>🔑</span>
              Security
            </button>
            <button
              type="button"
              className={`settings-menu ${
                activeTab==="app"?"active":""
              }`}
              onClick={()=>setActiveTab("app")}
            >
              <span>⚙</span>
              App settings
            </button>
            <button
              type="button"
              className={`settings-menu ${
                activeTab==="preferences"?"active":""
              }`}
              onClick={()=>setActiveTab("preferences")}
            >
              <span>☷</span>
              Preferences
            </button>
          </aside>
          {/* CONTENT */}
          <section className="settings-content">
            {/* ACCOUNT */}
            {activeTab==="account"&&(
              <div className="moderator-account-view">
                <div className="settings-section-title">
                  <h2>Account</h2>
                  <p>Account information and moderator permissions.</p>
                </div>
                <div className="moderator-account-grid">
                  <div className="moderator-account-info">
                    <div className="moderator-profile-card">
                      <div className="moderator-avatar">
                        {profilePhoto?(
                          <img src={profilePhoto} alt="Moderator profile" className="moderator-profile-image"/>
                        ):(
                          <svg width="92" height="92" viewBox="0 0 64 64" fill="none">
                            <circle cx="32" cy="32" r="32" fill="#e8edf5"/>
                            <circle cx="32" cy="24" r="10" fill="#344054"/>
                            <path d="M17 49c0-8 6.5-14 15-14s15 6 15 14" fill="#344054"/>
                          </svg>
                        )}
                        <label htmlFor="moderator-profile-upload" className="camera-icon" title="Profile photo uploads are not available yet" aria-disabled="true">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                            <circle cx="12" cy="13" r="4"/>
                          </svg>
                        </label>
                        <input id="moderator-profile-upload" type="file" accept="image/*" disabled aria-label="Profile photo upload unavailable" hidden/>
                      </div>
                      <h2>{name}</h2>
                      <p className="hint">Profile photo uploads are not available yet.</p>
                      <span className="moderator-badge">MODERATOR</span>
                      <p className="moderator-email">{email||"Email unavailable"}</p>
                      <p className="moderator-joined"><span>▣</span> Joined: {profile?.created_at?new Date(profile.created_at).toLocaleDateString():"Not available"}</p>
                    </div>
                    <div className="account-detail"><span>ACCOUNT TYPE</span><strong>Moderator</strong></div>
                    <div className="account-detail"><span>STATUS</span><strong className="status-active">Active</strong></div>
                    <div className="account-detail"><span>LAST LOGIN</span><strong>Not available</strong></div>
                    <div className="account-detail"><span>ACCOUNT CREATED</span><strong>{profile?.created_at?new Date(profile.created_at).toLocaleDateString():"Not available"}</strong></div>
                  </div>
                  <div className="moderator-permissions">
                    <h3>Role &amp; permissions</h3>
                    <div className="permission-list">
                      <div className="permission-item"><span>✓</span>View and manage comments</div>
                      <div className="permission-item"><span>✓</span>Access user reports</div>
                      <div className="permission-item"><span>✓</span>Moderate flagged comments</div>
                      <div className="permission-item"><span>✓</span>Review Traces</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* BASIC INFORMATION */}
            {activeTab==="basic"&&(
              <ProfileNameForm/>
            )}
            {/* SECURITY */}
            {activeTab==="security"&&(
              <div className="security-section">
                <div className="settings-section-title">
                  <h2>Security</h2>
                  <p>
                    Manage your password and account security.
                  </p>
                </div>
                <div className="account-security-card">
                  <div className="account-security-content">
                    <h3>
                      Account security
                    </h3>
                    <p>
                      Use an email recovery link to choose a new
                      password for your account. Your password
                      changes only after you complete the reset form.
                    </p>
                    <Link
                      to="/forgot-password"
                      className="btn blue sm"
                    >
                      Reset password
                    </Link>
                  </div>
                </div>
              </div>
            )}
            {/* APP SETTINGS */}
            {activeTab==="app"&&(
              <div>
                <div className="settings-section-title">
                  <h2>
                    App settings
                  </h2>
                  <p>
                    Manage your application preferences and appearance.
                  </p>
                </div>
                {/* NOTIFICATIONS */}
                <div className="preference-box">
                  <div>
                    <strong>
                      In-app notifications
                    </strong>
                    <p>
                      Status updates, comments, reports and review
                      notifications.
                    </p>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      disabled
                    />
                    <span></span>
                  </label>
                </div>
                {/* DATA SAVER */}
                <div className="preference-box app-setting-row">
                  <div>
                    <strong>
                      Data saver
                    </strong>
                    <p>
                      Reduce media quality to use less mobile data.
                    </p>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      disabled
                    />
                    <span></span>
                  </label>
                </div>
                {/* DARK MODE */}
                <div className="preference-box app-setting-row">
                  <div>
                    <strong>
                      Dark mode
                    </strong>
                    <p>
                      Switch between light and dark appearance.
                    </p>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={darkMode}
                      onChange={()=>
                        setDarkMode(!darkMode)
                      }
                    />
                    <span></span>
                  </label>
                </div>
              </div>
            )}
            {/* PREFERENCES */}
            {activeTab==="preferences"&&(
              <div>
                <div className="settings-section-title">
                  <h2>
                    Preferences
                  </h2>
                  <p>
                    Manage your notification preferences.
                  </p>
                </div>
                <div className="preference-box">
                  <div>
                    <strong>
                      Email notifications
                    </strong>
                    <p>
                      Email notification preferences are not
                      available yet. No changes are saved here.
                    </p>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      disabled
                    />
                    <span></span>
                  </label>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
