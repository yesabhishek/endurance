import { describe, expect, it } from "vitest";
import { squarify } from "./treemap";

describe("squarify", () => {
  const rect = { x: 0, y: 0, w: 600, h: 400 };
  const items = [60, 40, 30, 20, 20, 10, 5, 5, 0].map((value, i) => ({ id: `n${i}`, value }));
  const tiles = squarify(items, rect);

  it("drops empty items and keeps every other one", () => {
    expect(tiles).toHaveLength(8);
  });

  it("gives each tile an area proportional to its value", () => {
    const total = items.reduce((sum, item) => sum + item.value, 0);
    for (const tile of tiles) {
      expect(tile.w * tile.h).toBeCloseTo((tile.item.value / total) * rect.w * rect.h, 6);
    }
  });

  it("stays inside the rectangle", () => {
    for (const tile of tiles) {
      expect(tile.x).toBeGreaterThanOrEqual(-1e-9);
      expect(tile.y).toBeGreaterThanOrEqual(-1e-9);
      expect(tile.x + tile.w).toBeLessThanOrEqual(rect.w + 1e-9);
      expect(tile.y + tile.h).toBeLessThanOrEqual(rect.h + 1e-9);
    }
  });

  it("keeps tiles reasonably square", () => {
    const worst = Math.max(...tiles.map((tile) => Math.max(tile.w / tile.h, tile.h / tile.w)));
    expect(worst).toBeLessThan(4);
  });

  it("returns nothing for an empty or zero-size area", () => {
    expect(squarify([], rect)).toEqual([]);
    expect(squarify(items, { x: 0, y: 0, w: 0, h: 100 })).toEqual([]);
  });
});
