import { geoNaturalEarth1, geoPath } from "d3-geo";
import type { FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import atlas from "world-atlas/countries-110m.json";

/** A country's outline as an SVG path, with the country's ISO 3166-1 code. */
type Shape = {
  /**
   * The country's two-letter code, or null for a territory the map cannot
   * name: one the atlas draws without a code, such as Kosovo, or one missing
   * from the codes given to `worldMap`.
   */
  code: string | null;
  /** The outline, as the `d` attribute of an SVG `path`. */
  d: string;
};

/** The world's countries drawn on a map `width` units wide and `height` high. */
type WorldMap = { width: number; height: number; shapes: Shape[] };

/** The width of the map, in SVG units. Its height follows from it. */
const WIDTH = 960;

// Antarctica's numeric code. It is left off the map, since no book is
// published there and it would take a fifth of the height.
const ANTARCTICA = "010";

/** The map's outlines, each with the atlas's numeric code for its country. */
type Outlines = {
  height: number;
  shapes: { numeric: string | null; d: string }[];
};

let drawn: Outlines | undefined;

// Returns the outlines of every country but Antarctica, projected with the
// Natural Earth projection and fitted to `WIDTH`. They are computed on the
// first call, and the same object is returned after that. Path coordinates are
// rounded to whole units, which is finer than the map is drawn at and keeps
// the paths short.
function outlines(): Outlines {
  if (drawn) return drawn;

  const topology = atlas as unknown as Topology<{
    countries: GeometryCollection<{ name: string }>;
  }>;
  const all = feature(topology, topology.objects.countries);
  const world: FeatureCollection<Geometry, { name: string }> = {
    type: "FeatureCollection",
    features: all.features.filter(({ id }) => id !== ANTARCTICA),
  };

  const projection = geoNaturalEarth1().fitWidth(WIDTH, world);
  const path = geoPath(projection).digits(0);
  const [, [, bottom]] = path.bounds(world);

  drawn = {
    height: Math.ceil(bottom),
    shapes: world.features.map((country) => ({
      numeric: country.id ? String(country.id) : null,
      d: path(country) ?? "",
    })),
  };

  return drawn;
}

/**
 * Returns the countries of the world as SVG paths, with the two-letter code
 * each is stored under. The outlines are Natural Earth's at 1:110 million,
 * from the `world-atlas` package, which identifies countries by their numeric
 * ISO code. `codes` maps each numeric code, as three digits, to the two-letter
 * code, which is what publications store.
 */
function worldMap(codes: Record<string, string>): WorldMap {
  const { height, shapes } = outlines();

  return {
    width: WIDTH,
    height,
    shapes: shapes.map(({ numeric, d }) => ({
      code: numeric ? (codes[numeric] ?? null) : null,
      d,
    })),
  };
}

export { worldMap };
export type { WorldMap };
