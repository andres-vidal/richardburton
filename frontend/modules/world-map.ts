import { geoNaturalEarth1, geoPath } from "d3-geo";
import type { FeatureCollection, Geometry } from "geojson";
import countries from "i18n-iso-countries";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import atlas from "world-atlas/countries-110m.json";

/** A country's outline as an SVG path, with the country's ISO 3166-1 code. */
type Shape = {
  /**
   * The country's two-letter code, or null for a territory the atlas draws
   * without a code, such as Kosovo.
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

let drawn: WorldMap | undefined;

/**
 * Returns the countries of the world as SVG paths, projected with the Natural
 * Earth projection and fitted to `WIDTH`. The outlines are Natural Earth's at
 * 1:110 million, from the `world-atlas` package, which identifies countries by
 * their numeric ISO code. Each shape carries the two-letter code instead,
 * which is the code publications store.
 *
 * The map is computed on the first call and the same object is returned after
 * that. Path coordinates are rounded to whole units, which is finer than the
 * map is drawn at and keeps the paths short.
 */
function worldMap(): WorldMap {
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
    width: WIDTH,
    height: Math.ceil(bottom),
    shapes: world.features.map((country) => ({
      code: country.id
        ? (countries.numericToAlpha2(String(country.id)) ?? null)
        : null,
      d: path(country) ?? "",
    })),
  };

  return drawn;
}

export { worldMap };
export type { Shape, WorldMap };
