import { ApiError, authRequest, loadAccount } from "./auth.js";

export const SESSION_KEY = "tidetrace-session-v1";
const REFRESH_AHEAD = 60;
const now = () => Date.now() / 1000;
const cancelled = () => new ApiError("Sign-in was cancelled. Please try again.", "CANCELLED");

function tokens(session) {
  const expires_at = Number(session?.expires_at) || Math.floor(now()) + Number(session?.expires_in);
  if (typeof session?.access_token !== "string" || !session.access_token ||
      typeof session?.refresh_token !== "string" || !session.refresh_token || !Number.isFinite(expires_at)) {
    throw new ApiError("No renewable sign-in session was returned. Please log in again.", "MISSING_SESSION");
  }
  return { access_token: session.access_token, refresh_token: session.refresh_token, expires_at };
}

// Web Locks serialize token rotation across tabs. Older browsers use tab storage
// instead of sharing a single-use refresh token without a lock.
function browserStorage() {
  try {
    const shared = Boolean(navigator.locks?.request);
    const storage = shared ? window.localStorage : window.sessionStorage;
    const probe = `${SESSION_KEY}-probe`;
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return { storage, shared };
  } catch { return { storage: null, shared: false }; }
}

export function createSessionManager() {
  const { storage, shared } = browserStorage();
  let storageUsable = Boolean(storage);
  let memory = null;
  let epoch = 0;
  let pending = null;
  let started = false;
  let timer;
  let lastCheck = 0;
  let emailLink = /(?:^#|&)(access_token|error_code|error)=/.test(window.location.hash);
  const listeners = new Set();
  const read = () => {
    try { if (storageUsable) memory = storage.getItem(SESSION_KEY); }
    catch { storageUsable = false; }
    return memory;
  };
  const write = (value) => {
    memory = value;
    try {
      if (storageUsable) {
        if (value === null) storage.removeItem(SESSION_KEY);
        else storage.setItem(SESSION_KEY, value);
      }
    } catch { storageUsable = false; }
  };
  const lock = (operation) => shared ? navigator.locks.request(SESSION_KEY, operation) : Promise.resolve().then(operation);
  let snapshot = { account: null, ready: emailLink || !read(), error: "", notice: "" };
  const publish = (change) => {
    snapshot = { ...snapshot, ...change };
    listeners.forEach((listener) => listener());
  };

  function clearSession(notice = "") {
    epoch++;
    emailLink = false;
    write(null);
    publish({ account: null, ready: true, error: "", notice });
  }

  async function authenticate(getSession) {
    const attempt = ++epoch;
    const baseline = read();
    const supplied = await getSession();
    if (attempt !== epoch || read() !== baseline) throw cancelled();
    if (!supplied) return null;
    return lock(async () => {
      if (attempt !== epoch || read() !== baseline) throw cancelled();
      const session = tokens(supplied);
      const account = await loadAccount(session);
      if (attempt !== epoch || read() !== baseline) throw cancelled();
      write(JSON.stringify(session));
      emailLink = false;
      lastCheck = Date.now();
      publish({ account, ready: true, error: "", notice: "" });
      return account.role;
    });
  }

  function restore() {
    if (pending) return pending;
    const attempt = epoch;
    pending = lock(async () => {
      if (attempt !== epoch) return;
      let raw = read();
      if (!raw) { publish({ account: null, ready: true, error: "" }); return; }
      const current = () => attempt === epoch && read() === raw;
      let session;
      try { session = tokens(JSON.parse(raw)); }
      catch { if (current()) clearSession("Your saved session is invalid. Please log in again."); return; }
      if (snapshot.account?.accessToken !== session.access_token || session.expires_at <= now()) {
        publish({ account: null, ready: false, error: "" });
      }
      let refreshed = false;
      const refresh = async () => {
        const data = await authRequest("refresh", { body: { refresh_token: session.refresh_token } });
        if (!current()) throw cancelled();
        session = tokens(data.session);
        if (session.expires_at <= now()) throw new ApiError("Session expired.", "SESSION_EXPIRED");
        // Save rotated tokens before checking the profile: a temporary profile
        // outage must not leave the browser with a consumed refresh token.
        raw = JSON.stringify(session);
        write(raw);
        refreshed = true;
      };
      try {
        if (session.expires_at <= now() + REFRESH_AHEAD) await refresh();
        let account;
        try { account = await loadAccount(session); }
        catch (error) {
          if (error.status !== 401 || refreshed || !current()) throw error;
          await refresh();
          account = await loadAccount(session);
        }
        if (!current()) return;
        lastCheck = Date.now();
        publish({ account, ready: true, error: "", notice: "" });
      } catch (error) {
        if (!current() || error.code === "CANCELLED") return;
        const permanent = [400, 401, 403, 404].includes(error.status) ||
          ["ACCOUNT_SUSPENDED", "INVALID_PROFILE", "MISSING_SESSION", "SESSION_EXPIRED"].includes(error.code);
        if (permanent) {
          clearSession(["ACCOUNT_SUSPENDED", "PROFILE_MISSING"].includes(error.code) ? error.message : "Your session has ended. Please log in again.");
        } else {
          const account = snapshot.account?.expiresAt > now() ? snapshot.account : null;
          publish({ account, ready: true, error: "We couldn’t reconnect to your account. Check your connection and try again." });
        }
      }
    }).finally(() => { pending = null; });
    return pending;
  }

  async function logout() {
    let token = snapshot.account?.accessToken;
    try { token ||= JSON.parse(read())?.access_token; } catch { /* No usable saved token. */ }
    clearSession();
    if (token) await authRequest("logout", { token, method: "POST" });
  }

  function check() {
    if (emailLink || !read()) return;
    if (snapshot.error || !snapshot.account || snapshot.account.expiresAt <= now() + REFRESH_AHEAD || Date.now() - lastCheck >= 60000) {
      // Hide expired accounts immediately, including after a laptop wakes up.
      if (snapshot.account?.expiresAt <= now()) publish({ account: null, ready: false });
      void restore();
    }
  }

  function changed(event) {
    if (!shared || (event.key !== SESSION_KEY && event.key !== null) || (event.storageArea && event.storageArea !== storage)) return;
    epoch++;
    publish({ account: null, ready: !read(), error: "", notice: read() ? "" : "You have been signed out in another tab." });
    // The old request must settle before checking the latest stored token pair.
    void (pending || Promise.resolve()).then(() => restore());
  }

  return {
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot: () => snapshot,
    authenticate, clearSession, logout, retrySession: restore,
    start() {
      if (started) return () => {};
      started = true;
      try { window.localStorage.removeItem("tidetrace-role"); } catch { /* Optional legacy cleanup. */ }
      // Never restore an unrelated account over a signup/recovery email link.
      if (!emailLink) void restore();
      timer = window.setInterval(check, 30000);
      window.addEventListener("storage", changed);
      window.addEventListener("focus", check);
      window.addEventListener("online", check);
      document.addEventListener("visibilitychange", check);
      return () => {
        started = false;
        window.clearInterval(timer);
        window.removeEventListener("storage", changed);
        window.removeEventListener("focus", check);
        window.removeEventListener("online", check);
        document.removeEventListener("visibilitychange", check);
      };
    },
  };
}
