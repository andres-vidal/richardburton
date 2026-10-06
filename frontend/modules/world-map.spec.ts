import { worldMap } from "./world-map";

describe("worldMap", () => {
  test("names each outline by the alpha-2 code its numeric code maps to", () => {
    const map = worldMap({ "840": "US", "036": "AU" });
    const named = map.shapes.filter(({ code }) => code !== null);

    expect(named.map(({ code }) => code).sort()).toEqual(["AU", "US"]);
    expect(named.every(({ d }) => d.startsWith("M"))).toBe(true);
  });

  test("leaves an outline unnamed when its numeric code is not given", () => {
    const shapes = worldMap({}).shapes;

    expect(shapes.length).toBeGreaterThan(170);
    expect(shapes.every(({ code }) => code === null)).toBe(true);
  });

  test("draws the outlines once and fits them to the width", () => {
    const first = worldMap({});
    const second = worldMap({ "840": "US" });

    expect(first.width).toBe(960);
    expect(first.height).toBeLessThan(first.width);
    expect(second.shapes.map(({ d }) => d)).toEqual(
      first.shapes.map(({ d }) => d),
    );
  });
});
