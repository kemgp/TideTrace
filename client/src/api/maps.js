let loading;
let authFailed = false;
const failureListeners = new Set();
export const mapsConfigured = () => Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim());
export const mapId = () => import.meta.env.VITE_GOOGLE_MAPS_MAP_ID?.trim() || "DEMO_MAP_ID";
export function onMapAuthFailure(listener) {
  failureListeners.add(listener);
  if (authFailed) listener();
  return () => failureListeners.delete(listener);
}

// Shared across maps and React StrictMode mounts; load once when a configured map mounts.
export function loadMaps() {
  if (authFailed) return Promise.reject(new Error("Map access is unavailable. You can still use the location name."));
  if (loading) return loading;
  if (!mapsConfigured()) return Promise.reject(new Error("Maps are not available. You can still use the location name."));
  loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // Keep the callback safe if a timed-out script arrives late.
      window.__tidetraceMapsReady = () => {};
      if (error) { script.remove(); reject(error); }
      else resolve(window.google.maps);
    };
    const timer = setTimeout(() => finish(new Error("The map took too long to load. Reload the page to try again.")), 20000);
    const previousFailure = window.gm_authFailure;
    window.gm_authFailure = () => {
      authFailed = true;
      finish(new Error("Map access is unavailable. You can still use the location name."));
      failureListeners.forEach((listener) => listener());
      previousFailure?.();
    };
    window.__tidetraceMapsReady = async () => {
      try {
        await Promise.all([window.google.maps.importLibrary("maps"), window.google.maps.importLibrary("marker")]);
        finish();
      } catch { finish(new Error("The map could not load. Reload the page to try again.")); }
    };
    const params = new URLSearchParams({ key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY.trim(), loading: "async", callback: "__tidetraceMapsReady", v: "weekly" });
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = () => finish(new Error("The map could not load. Check your connection and reload the page."));
    document.head.append(script);
  });
  return loading;
}

export function coordinates(latitude, longitude) {
  if (latitude == null || longitude == null || latitude === "" || longitude === "") return null;
  const lat = Number(latitude), lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

// Display-only reverse lookup; never writes Google's address into a Trace.
export async function lookupPinLocation(position, signal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  const timer = setTimeout(abort, 10000);
  try {
    const response = await fetch(`https://geocode.googleapis.com/v4/geocode/location/${position.lat},${position.lng}`, {
      signal: controller.signal,
      headers: { "X-Goog-Api-Key": import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() || "", "X-Goog-FieldMask": "results.formattedAddress" },
    });
    if (!response.ok) throw new Error("Location lookup unavailable");
    const data = await response.json();
    return data.results?.find((result) => typeof result.formattedAddress === "string" && result.formattedAddress.trim())?.formattedAddress || null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
