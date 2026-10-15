import { result } from "./errors.js";

// Sign each distinct author photo once per response, under the caller's RLS.
// A missing photo or Storage outage must not hide otherwise readable Traces.
export async function withAuthorPhotos(db, rows) {
  const paths = [...new Set(rows.map((row) => row.author?.avatar_path).filter(Boolean))];
  let urls = new Map();
  if (paths.length) {
    try {
      const { data, error } = await db.storage.from("profile-photos").createSignedUrls(paths, 3600);
      if (!error) urls = new Map((data || []).filter((item) => !item.error && item.signedUrl).map((item) => [item.path, item.signedUrl]));
    } catch { /* Use initials until the next read succeeds. */ }
  }
  return rows.map((row) => {
    if (!row.author) return row;
    const { avatar_path, ...author } = row.author;
    return { ...row, author: { ...author, avatar_url: urls.get(avatar_path) || null } };
  });
}

export async function cleanupProfilePhotos(db) {
  const candidates = await result(db.rpc("claim_profile_photo_cleanup"));
  const paths = candidates.map((row) => row.object_path);
  if (!paths.length) return 0;
  const removed = await result(db.storage.from("profile-photos").remove(paths));
  return removed?.length || 0;
}
