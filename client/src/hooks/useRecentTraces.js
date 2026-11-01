import { useEffect, useState } from "react";
import { getData } from "../api/data.js";
import { PHOTO_TYPES } from "../api/photos.js";

const SHOWN = 10;
const MIN_TILES = 4;

// Public landing strip: approved traces that have a photo, never sensitive ones, and only the
// fields a stranger should see (photo, title, category, place). No author, no coordinates.
export function pickTiles(rows) {
  return (Array.isArray(rows) ? rows : []).flatMap(trace => {
    if (!trace || trace.is_sensitive || !Array.isArray(trace.trace_media)) return [];
    const photo = trace.trace_media.filter(item => PHOTO_TYPES.includes(item.mime_type))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0];
    if (!photo?.id) return [];
    return [{ id: trace.id, title: trace.title || "Untitled trace", category: trace.category?.name || "",
      place: trace.location_name || "", photoId: photo.id }];
  }).slice(0, SHOWN);
}

export default function useRecentTraces(active) {
  const [state, setState] = useState({ status: "idle", tiles: [] });
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController(); let alive = true;
    setState({ status: "loading", tiles: [] });
    (async () => {
      try {
        const picked = pickTiles(await getData("traces?limit=24", { signal: controller.signal }));
        const urls = await Promise.all(picked.map(tile => getData(`media/${encodeURIComponent(tile.photoId)}/url`, { signal: controller.signal })
          .then(data => data?.url || "").catch(() => "")));
        const tiles = picked.map((tile, i) => ({ ...tile, url: urls[i] })).filter(tile => tile.url);
        if (alive) setState({ status: tiles.length >= MIN_TILES ? "ready" : "empty", tiles });
      } catch { if (alive) setState({ status: "empty", tiles: [] }); }
    })();
    return () => { alive = false; controller.abort(); };
  }, [active]);
  return state;
}
