import { photoError } from "./photos.js";

export async function compressPhoto(file, { maxSize = 1600 } = {}) {
  const invalid = photoError(file);
  if (invalid) throw new Error(invalid);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("This photo could not be opened. Choose another photo."));
      image.src = url;
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("This photo has no image dimensions.");
    const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Photo compression is unavailable in this browser.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", .82));
    if (!blob?.size) throw new Error("Could not prepare the smaller photo. Please try again.");
    if (blob.size >= file.size) return file;
    const extension = blob.type === "image/webp" ? "webp" : "png";
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.${extension}`, { type: blob.type, lastModified: file.lastModified });
  } finally { URL.revokeObjectURL(url); }
}

// Lesson covers and images: shrink them when this browser can, otherwise upload the original (the server
// still enforces its size limit). Large originals cost download data on every lesson view.
export async function compressIfPossible(file, options) {
  let drawable = null;
  try { drawable = document.createElement("canvas").getContext("2d"); } catch { drawable = null; }
  if (!drawable) return file;
  try { return await compressPhoto(file, options); } catch { return file; }
}
