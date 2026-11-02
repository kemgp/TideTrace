import { useEffect, useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const keyFor = (key) => `scroll:${key}`;
const root = () => (typeof document === "undefined" ? null : document.scrollingElement || document.documentElement);
const read = (key) => { try { const value = Number(sessionStorage.getItem(key)); return Number.isFinite(value) && value > 0 ? value : 0; } catch { return 0; } };
const write = (key, value) => { try { sessionStorage.setItem(key, String(value)); } catch { /* storage unavailable */ } };

// Scrolls to y once the page is tall enough (content may still be loading); gives up after
// about 1.5 seconds or as soon as the person scrolls by themselves.
export function scrollToWhenReady(y) {
  const element = root();
  if (!element || !y || typeof requestAnimationFrame !== "function") return () => {};
  const started = Date.now();
  let frame = 0;
  let stopped = false;
  const stop = () => { stopped = true; cancelAnimationFrame(frame); window.removeEventListener("wheel", stop); window.removeEventListener("touchstart", stop); window.removeEventListener("keydown", stop); };
  const step = () => {
    if (stopped) return;
    element.scrollTop = y;
    if (Math.abs(element.scrollTop - y) < 2 || Date.now() - started > 1500) { stop(); return; }
    frame = requestAnimationFrame(step);
  };
  window.addEventListener("wheel", stop, { passive: true });
  window.addEventListener("touchstart", stop, { passive: true });
  window.addEventListener("keydown", stop);
  frame = requestAnimationFrame(step);
  return stop;
}

// Opening a page starts at the top; browser Back/Forward returns to where the person was.
// Replacing the URL in place (for example while typing a search) never moves the page.
export default function ScrollManager() {
  const location = useLocation();
  const type = useNavigationType();
  useEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
  }, []);
  useEffect(() => {
    const element = root();
    if (!element) return undefined;
    const save = () => write(keyFor(location.key), element.scrollTop);
    window.addEventListener("scroll", save, { passive: true });
    return () => window.removeEventListener("scroll", save);
  }, [location.key]);
  useLayoutEffect(() => {
    const element = root();
    if (!element) return undefined;
    if (type === "PUSH") { element.scrollTop = 0; return undefined; }
    if (type === "POP") return scrollToWhenReady(read(keyFor(location.key)));
    return undefined;
  }, [location.key, type]);
  return null;
}
