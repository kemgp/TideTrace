export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    Object.assign(this, { status, code, details });
  }
}

export function upstreamError(error) {
  const code = String(error.error_code || error.code || "UPSTREAM_ERROR");
  if (code === "over_email_send_rate_limit") return new HttpError(429, "EMAIL_RATE_LIMITED", "Supabase's email sending limit has been reached. Check your inbox and spam folder for the latest email. Wait before requesting another; if the hourly quota is exhausted, it must reset first.");
  if (code === "over_request_rate_limit") return new HttpError(429, "AUTH_RATE_LIMITED", "Supabase received too many authentication requests. Wait a few minutes before trying again.");
  if (code === "invalid_credentials") return new HttpError(401, "INVALID_CREDENTIALS", "The email or password is incorrect.");
  if (code === "email_not_confirmed") return new HttpError(403, "EMAIL_NOT_CONFIRMED", "Confirm your email before signing in.");
  if (code === "otp_expired") return new HttpError(400, "INVALID_VERIFICATION_CODE", "That verification code is invalid or expired. Request a new email and try again.");
  if (code === "weak_password") return new HttpError(400, "WEAK_PASSWORD", "Choose a stronger password that meets the account password requirements.");
  if (code === "same_password") return new HttpError(400, "SAME_PASSWORD", "Choose a password different from your current password.");
  if (["reauthentication_needed", "reauthentication_not_valid"].includes(code)) return new HttpError(401, "RECOVERY_EXPIRED", "Request a new password recovery email, then try again using its newest link or code.");
  if (code === "40001") return new HttpError(409, "STALE_VERSION", "This record changed. Reload it before retrying.");
  if (code === "42501") return new HttpError(403, "FORBIDDEN", "You do not have permission to perform this action.");
  if (code === "23505") return new HttpError(409, "ALREADY_EXISTS", "This record already exists.");
  if (code === "PGRST116") return new HttpError(404, "NOT_FOUND", "Record not found.");
  if (code === "P0001") return new HttpError(400, "WORKFLOW_ERROR", error.message || "This action is not allowed.");
  if (/^(22|23)/.test(code)) return new HttpError(400, "INVALID_DATA", "The supplied values do not satisfy the database constraints.");
  const status = Number(error.status || error.statusCode);
  if (status === 401) return new HttpError(401, "UNAUTHENTICATED", "Your session is invalid or expired.");
  if (status === 403) return new HttpError(403, "FORBIDDEN", "This action is not allowed.");
  if (status === 404) return new HttpError(404, "NOT_FOUND", "Record not found.");
  if (status === 429) return new HttpError(429, "RATE_LIMITED", "Too many requests. Please try again later.");
  if (status === 400 || status === 422) return new HttpError(400, "REQUEST_REJECTED", "The request could not be completed. Check your input or account confirmation.");
  return new HttpError(502, "UPSTREAM_ERROR", "Supabase could not complete the request.");
}

export async function result(query) {
  const { data, error } = await query;
  if (error) throw upstreamError(error);
  return data;
}

export function first(rows) {
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) throw new HttpError(404, "NOT_FOUND", "Record not found.");
  return row;
}
