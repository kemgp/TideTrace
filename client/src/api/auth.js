export const ROLE_HOME = { user: "/user/dashboard", mod: "/moderator/dashboard", admin: "/admin/dashboard" };
const UI_ROLES = { user: "user", moderator: "mod", admin: "admin" };

export class ApiError extends Error {
  constructor(message, code, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function authRequest(path, { body, token, method = body === undefined ? "GET" : "POST" } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`/api/auth/${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    if (response.status === 204) return null;
    let payload;
    try { payload = await response.json(); }
    catch { throw new ApiError("Cannot reach the sign-in service. Make sure the backend is running and try again.", "SERVICE_UNAVAILABLE", response.status); }
    if (!response.ok) throw new ApiError(payload.error?.message || "The request failed. Please try again.", payload.error?.code, response.status);
    if (!Object.hasOwn(payload, "data")) throw new ApiError("The sign-in service returned an unexpected response.", "INVALID_RESPONSE");
    return payload.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(controller.signal.aborted ? "The request timed out. Please try again." : "Cannot reach the sign-in service. Check your connection and try again.", "NETWORK_ERROR");
  } finally { clearTimeout(timer); }
}

export async function loadAccount(session) {
  if (!session?.access_token) throw new ApiError("No sign-in session was returned. Please log in again.", "MISSING_SESSION");
  const profile = await authRequest("me", { token: session.access_token });
  if (profile.status !== "active") throw new ApiError("Your account is suspended. Contact an administrator for help.", "ACCOUNT_SUSPENDED");
  const role = UI_ROLES[profile.role];
  if (!role || !profile.id) throw new ApiError("Your account does not have a supported role. Contact an administrator.", "INVALID_PROFILE");
  const expiresAt = Number(session.expires_at) || Math.floor(Date.now() / 1000) + Number(session.expires_in);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() / 1000) throw new ApiError("Your sign-in session has expired. Please log in again.", "SESSION_EXPIRED");
  // The first auth integration keeps only the access token in memory.
  return { profile, role, accessToken: session.access_token, expiresAt };
}

export function readConfirmation(location) {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  if (params.has("error") || params.has("error_code")) return { error: "This confirmation link is invalid or expired. Request a new email from the login page." };
  const access_token = params.get("access_token");
  if (!access_token) return null;
  if (params.get("type") === "recovery") return { error: "Password recovery is not available in the app yet. Contact an administrator for help." };
  return { session: { access_token, expires_at: params.get("expires_at"), expires_in: params.get("expires_in") } };
}
