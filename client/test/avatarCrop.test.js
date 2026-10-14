import { expect, it } from "vitest";
import { avatarCrop } from "../src/api/avatarCrop.js";

it("centers a square crop inside landscape and portrait images", () => {
  expect(avatarCrop(1200, 800)).toEqual({ x: 200, y: 0, size: 800 });
  expect(avatarCrop(800, 1200)).toEqual({ x: 0, y: 200, size: 800 });
});

it("keeps every zoomed and repositioned crop inside the source image", () => {
  for (const [width, height] of [[1200, 800], [800, 1200], [800, 800]]) {
    for (const zoom of [1, 1.5, 3]) {
      for (const x of [-2, -1, 0, 1, 2]) for (const y of [-2, -1, 0, 1, 2]) {
        const crop = avatarCrop(width, height, zoom, x, y);
        expect(crop.x).toBeGreaterThanOrEqual(0);
        expect(crop.y).toBeGreaterThanOrEqual(0);
        expect(crop.x + crop.size).toBeLessThanOrEqual(width + 1e-8);
        expect(crop.y + crop.size).toBeLessThanOrEqual(height + 1e-8);
      }
    }
  }
});
