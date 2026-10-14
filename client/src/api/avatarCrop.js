// The preview and exported image share the same source rectangle.
export function avatarCrop(width, height, zoom = 1, x = 0, y = 0) {
  const size = Math.min(width, height) / Math.max(1, zoom);
  return {
    x: (width - size) * (Math.max(-1, Math.min(1, x)) + 1) / 2,
    y: (height - size) * (Math.max(-1, Math.min(1, y)) + 1) / 2,
    size,
  };
}

export async function exportAvatar(image, crop) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Photo editing is unavailable in this browser.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, 512, 512);
  context.drawImage(image, crop.x, crop.y, crop.size, crop.size, 0, 0, 512, 512);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The photo could not be prepared. Please choose it again.");
  return new File([blob], "profile-photo.png", { type: "image/png" });
}
