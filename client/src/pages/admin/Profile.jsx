import React,{useState} from "react";
import {Link} from "react-router-dom";
import ProfileNameForm from "../../components/ProfileNameForm.jsx";
import {useApp} from "../../context/AppContext.jsx";

export default function AdminProfile(){
  const {profile}=useApp();
  const [activeTab,setActiveTab]=useState("account");

  const name=profile?.display_name||"";
  const email=profile?.email||"";
  const profilePhoto="";

  return(
    <main className="settings-page">
      <div className="settings-container">

        <div className="settings-title">
          <div className="settings-heading">
            <span>SETTINGS</span>
            <h1>Account & preferences</h1>
          </div>
        </div>

        <div className="settings-layout">

          <aside className="settings-sidebar">

            <button
              className={`settings-menu ${activeTab==="account"?"active":""}`}
              onClick={()=>setActiveTab("account")}
            >
              <span>♟</span>
              Account
            </button>

            <button
              className={`settings-menu ${activeTab==="basic"?"active":""}`}
              onClick={()=>setActiveTab("basic")}
            >
              <span>👤</span>
              Basic information
            </button>

            <button
              className={`settings-menu ${activeTab==="security"?"active":""}`}
              onClick={()=>setActiveTab("security")}
            >
              <span>🔑</span>
              Security
            </button>

            <button
              className={`settings-menu ${activeTab==="activity"?"active":""}`}
              onClick={()=>setActiveTab("activity")}
            >
              <span>📊</span>
              Recent activity
            </button>

            <button
              className={`settings-menu ${activeTab==="actions"?"active":""}`}
              onClick={()=>setActiveTab("actions")}
            >
              <span>⚡</span>
              Quick actions
            </button>

          </aside>

          <section className="settings-content">

            {activeTab==="account"&&(
              <div>

                <div className="settings-section-title">
                  <h2>Account</h2>
                  <p>
                    Account information and administrator permissions.
                  </p>
                </div>

                <div className="admin-account-grid">

                  <div className="admin-account-info">

                    <div className="admin-profile-card">

                      <div className="admin-avatar">

                        {profilePhoto?(
                          <img
                            src={profilePhoto}
                            alt="Admin profile"
                            className="admin-profile-image"
                          />
                        ):(
                          <svg
                            width="92"
                            height="92"
                            viewBox="0 0 64 64"
                            fill="none"
                          >
                            <circle
                              cx="32"
                              cy="32"
                              r="32"
                              fill="#e8edf5"
                            />

                            <circle
                              cx="32"
                              cy="24"
                              r="10"
                              fill="#344054"
                            />

                            <path
                              d="M17 49c0-8 6.5-14 15-14s15 6 15 14"
                              fill="#344054"
                            />
                          </svg>
                        )}

                        <label
                          htmlFor="admin-profile-upload"
                          className="admin-camera-icon"
                          title="Profile photo uploads are not available yet"
                          aria-disabled="true"
                        >
                          <svg
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="white"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                            <circle cx="12" cy="13" r="4"/>
                          </svg>
                        </label>

                        <input
                          id="admin-profile-upload"
                          type="file"
                          accept="image/*"
                          disabled
                          aria-label="Profile photo upload unavailable"
                          hidden
                        />

                      </div>

                      <h2>{name}</h2>

                      <p className="hint">
                        Profile photo uploads are not available yet.
                      </p>

                      <span className="admin-badge">
                        ADMIN
                      </span>

                      <p className="admin-email">
                        {email||"Email unavailable"}
                      </p>

                      <p className="admin-joined">
                        <span>▣</span>
                        Joined:{" "}
                        {profile?.created_at
                          ?new Date(profile.created_at).toLocaleDateString()
                          :"Not available"}
                      </p>

                    </div>

                    <div className="account-detail">
                      <span>ACCOUNT TYPE</span>
                      <strong>Admin</strong>
                    </div>

                    <div className="account-detail">
                      <span>STATUS</span>
                      <strong className="status-active">
                        Active
                      </strong>
                    </div>

                    <div className="account-detail">
                      <span>LAST LOGIN</span>
                      <strong>
                        Not available
                      </strong>
                    </div>

                    <div className="account-detail">
                      <span>ACCOUNT CREATED</span>
                      <strong>
                        {profile?.created_at
                          ?new Date(profile.created_at).toLocaleDateString()
                          :"Not available"}
                      </strong>
                    </div>

                  </div>

                  <div className="admin-permissions">

                    <h3>Role & permissions</h3>

                    <div className="permission-list">

                      <div className="permission-item">
                        <span>✓</span>
                        Full access
                      </div>

                      <div className="permission-item">
                        <span>✓</span>
                        Review user traces
                      </div>

                      <div className="permission-item">
                        <span>✓</span>
                        Manage users
                      </div>

                      <div className="permission-item">
                        <span>✓</span>
                        Manage moderator
                      </div>

                      <div className="permission-item">
                        <span>✓</span>
                        Manage Tides
                      </div>

                      <div className="permission-item">
                        <span>✓</span>
                        Trace Categories
                      </div>

                    </div>

                  </div>

                </div>

              </div>
            )}

            {activeTab==="basic"&&(
              <ProfileNameForm/>
            )}

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
    <h3>Account security</h3>

    <p>
      Use an email recovery link to choose a new password
      for your account. Your password changes only after
      you complete the reset form.
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

            {activeTab==="activity"&&(
              <div>

                <div className="settings-section-title">
                  <h2>Recent activity</h2>
                  <p>
                    Recent actions performed by the administrator.
                  </p>
                </div>

                <div className="activity-list">

                  <div className="activity-item">
                    <strong>Reviewed a user trace</strong>
                    <span>Today · 9:15 AM</span>
                  </div>

                  <div className="activity-item">
                    <strong>Managed moderator accounts</strong>
                    <span>Today · 8:42 AM</span>
                  </div>

                  <div className="activity-item">
                    <strong>Updated trace categories</strong>
                    <span>Yesterday · 4:30 PM</span>
                  </div>

                  <div className="activity-item">
                    <strong>Viewed system logs</strong>
                    <span>Yesterday · 2:15 PM</span>
                  </div>

                </div>

              </div>
            )}

            {activeTab==="actions"&&(
              <div>

                <div className="settings-section-title">
                  <h2>Quick actions</h2>
                  <p>
                    Quick access to important administrator tools.
                  </p>
                </div>

                <div className="quick-actions">

                  <button
                    type="button"
                    disabled
                    title="This account action is not available yet"
                  >
                    <strong>View system logs</strong>
                    <span>
                      Check recent system activity and events.
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled
                    title="This account action is not available yet"
                  >
                    <strong>Manage users</strong>
                    <span>
                      View and manage registered users.
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled
                    title="This account action is not available yet"
                  >
                    <strong>System settings</strong>
                    <span>
                      Manage system-wide settings.
                    </span>
                  </button>

                </div>

              </div>
            )}

          </section>

        </div>

      </div>
    </main>
  );
}