import { ApiError } from "./auth.js";
import { compressIfPossible } from "./compressPhoto.js";

const UPLOAD_LIMIT = 8 * 1024 * 1024;

// Every Trace photo is resized to 1600 px WebP before upload when the browser can. Data Saver already did
// it when the photo was chosen. Phone photos are often several MB; the API accepts up to 8 MB.
export async function prepareTracePhoto(file, { dataSaver = false } = {}) {
  const prepared = dataSaver ? file : await compressIfPossible(file);
  if (prepared.size > UPLOAD_LIMIT) throw new ApiError("This photo is too large to upload. Choose a photo under 8 MB.", "PHOTO_TOO_LARGE");
  return prepared;
}

// After the photo is saved, a 480 px WebP for cards and lists. Best effort: if it cannot be made or sent,
// cards show the full photo instead and nothing else changes.
export async function addThumbnail(writeData, mediaId, source, signal) {
  try {
    const thumb = await compressIfPossible(source, { maxSize: 480 });
    if (thumb === source || thumb.type !== "image/webp" || signal?.aborted) return;
    await writeData(`media/${encodeURIComponent(mediaId)}/thumb`, { method: "POST", file: thumb, signal });
  } catch { /* Cards fall back to the original photo. */ }
}
