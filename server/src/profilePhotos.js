import { result } from "./errors.js";

// Sign each distinct author photo once per response, under the caller's RLS, reusing recent links
// (`links` is the app's signedLinks cache) so browsers keep the photo cached.
// A missing photo or Storage outage must not hide otherwise readable Traces.
export async function withAuthorPhotos(db, links, rows) {
  const paths = [...new Set(rows.map((row) => row.author?.avatar_path).filter(Boolean))];
  let urls = new Map();
  if (paths.length) {
    try { urls = await links.many(db, "profile-photos", paths); }
    catch { /* Use initials until the next read succeeds. */ }
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
