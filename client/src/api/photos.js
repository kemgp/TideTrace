export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function photoError(file) {
  if (!PHOTO_TYPES.includes(file.type)) return "Choose a JPEG, PNG or WebP photo.";
  if (!file.size || file.size > 20 * 1024 * 1024) return "Choose a non-empty photo no larger than 20 MB.";
  return "";
}
