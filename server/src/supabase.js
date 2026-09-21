import { createClient } from "@supabase/supabase-js";
import { HttpError, upstreamError } from "./errors.js";

export function createSupabase(config, fetchImpl = fetch) {
  const timedFetch = async (input, init = {}) => {
    const timeout = AbortSignal.timeout(15000);
    const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    try { return await fetchImpl(input, { ...init, signal }); }
    catch (error) {
      if (timeout.aborted) throw new HttpError(504, "UPSTREAM_TIMEOUT", "Supabase timed out. Please try again.");
      throw new HttpError(502, "UPSTREAM_UNAVAILABLE", "Cannot reach Supabase.");
    }
  };
  return {
    // A fresh client per request prevents one caller's session leaking into another.
    client(token) {
      return createClient(config.url, config.key, {
        db: { retry: false },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: timedFetch, headers: token ? { Authorization: `Bearer ${token}` } : {} },
      });
    },
    // GoTrue HTTP endpoints let us use the caller's JWT without storing a session.
    async auth(path, { body, token, method = "POST" } = {}) {
      const headers = { apikey: config.key, "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await timedFetch(`${config.url}/auth/v1/${path}`, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      });
      const raw = await response.text();
      let data;
      try { data = raw ? JSON.parse(raw) : null; }
      catch { throw new HttpError(502, "UPSTREAM_ERROR", "Invalid response from Supabase."); }
      if (!response.ok) throw upstreamError({ ...data, status: response.status });
      return data;
    },
  };
}

export function sessionResponse(data) {
  const user = data?.user || (data?.id ? data : null);
  return {
    user: user ? { id: user.id, email: user.email } : null,
    session: data?.access_token ? {
      access_token: data.access_token, refresh_token: data.refresh_token,
      expires_in: data.expires_in, token_type: data.token_type || "bearer",
      expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
    } : null,
  };
}
