import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { forgetMedia, loadMedia } from "../api/mediaLinks.js";

// The address to show one Trace photo or video, from mediaLinks.js. `attempt` above 0 means "try again":
// the remembered link is dropped first, so a link that stopped working is replaced.
export default function useMediaSource(id, { skip = false, attempt = 0, size } = {}) {
  const { readData, profile } = useApp();
  const owner = profile?.id;
  const [state, setState] = useState({ url: "", error: "" });
  useEffect(() => {
    setState({ url: "", error: "" });
    if (!id || skip) return undefined;
    if (attempt) forgetMedia(owner, id, size);
    const controller = new AbortController();
    let revoke = null;
    loadMedia({ id, owner, size, read: readData, signal: controller.signal }).then((media) => {
      if (controller.signal.aborted) { media.revoke?.(); return; }
      revoke = media.revoke;
      setState({ url: media.url, error: "" });
    }).catch((failure) => {
      if (!controller.signal.aborted) setState({ url: "", error: failure?.message || "No photo preview was returned." });
    });
    return () => { controller.abort(); revoke?.(); };
  }, [id, skip, attempt, size, owner, readData]);
  return state;
}
