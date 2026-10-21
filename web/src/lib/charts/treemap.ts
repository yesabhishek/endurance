export type Rect = { x: number; y: number; w: number; h: number };

function worst(areas: number[], side: number) {
  const sum = areas.reduce((total, area) => total + area, 0);
  const max = Math.max(...areas);
  const min = Math.min(...areas);
  return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
}

/**
 * Squarified treemap (Bruls, Huizing & van Wijk). Lays items out inside `rect`
 * with areas proportional to `value`, keeping tiles as close to square as it can.
 */
export function squarify<T extends { value: number }>(items: T[], rect: Rect): Array<{ item: T } & Rect> {
  const positive = items.filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
  const total = positive.reduce((sum, item) => sum + item.value, 0);
  if (!total || rect.w <= 0 || rect.h <= 0) return [];

  const scale = (rect.w * rect.h) / total;
  const nodes = positive.map((item) => ({ item, area: item.value * scale }));
  const out: Array<{ item: T } & Rect> = [];
  let space = { ...rect };
  let row: typeof nodes = [];

  const place = () => {
    const sum = row.reduce((total, node) => total + node.area, 0);
    if (space.w >= space.h) {
      const width = sum / space.h;
      let y = space.y;
      for (const node of row) {
        const height = node.area / width;
        out.push({ item: node.item, x: space.x, y, w: width, h: height });
        y += height;
      }
      space = { x: space.x + width, y: space.y, w: space.w - width, h: space.h };
    } else {
      const height = sum / space.w;
      let x = space.x;
      for (const node of row) {
        const width = node.area / height;
        out.push({ item: node.item, x, y: space.y, w: width, h: height });
        x += width;
      }
      space = { x: space.x, y: space.y + height, w: space.w, h: space.h - height };
    }
    row = [];
  };

  let index = 0;
  while (index < nodes.length) {
    const side = Math.min(space.w, space.h);
    const node = nodes[index];
    const areas = row.map((n) => n.area);
    if (!row.length || worst([...areas, node.area], side) <= worst(areas, side)) {
      row.push(node);
      index += 1;
    } else {
      place();
    }
  }
  if (row.length) place();
  return out;
}
