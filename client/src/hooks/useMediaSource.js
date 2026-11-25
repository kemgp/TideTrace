import { useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { forgetMedia, loadMedia } from "../api/mediaLinks.js";

// The address to show one Trace photo or video, from mediaLinks.js. `attempt` above 0 means "try again":
// the remembered link is dropped first, so a link that stopped working is replaced.
// `link`: the link the list or Trace page sent with this photo (`suppliedLink`); used on the first try only.
export default function useMediaSource(id, { skip = false, attempt = 0, size, link } = {}) {
  const { readData, profile } = useApp();
  const owner = profile?.id;
  const suppliedUrl = attempt ? "" : link?.url || "";
  // The seconds left count down between responses; only a new link should reload the photo.
  const suppliedSeconds = useRef(link?.expires_in);
  useEffect(() => { suppliedSeconds.current = link?.expires_in; }, [link?.expires_in]);
  const [state, setState] = useState({ url: "", error: "" });
  useEffect(() => {
    setState({ url: "", error: "" });
    if (!id || skip) return undefined;
    if (attempt) forgetMedia(owner, id, size);
    const controller = new AbortController();
    let revoke = null;
    const supplied = suppliedUrl ? { url: suppliedUrl, expires_in: suppliedSeconds.current } : null;
    loadMedia({ id, owner, size, supplied, read: readData, signal: controller.signal }).then((media) => {
      if (controller.signal.aborted) { media.revoke?.(); return; }
      revoke = media.revoke;
      setState({ url: media.url, error: "" });
    }).catch((failure) => {
      if (!controller.signal.aborted) setState({ url: "", error: failure?.message || "No photo preview was returned." });
    });
    return () => { controller.abort(); revoke?.(); };
  }, [id, skip, attempt, size, owner, readData, suppliedUrl]);
  return state;
}
