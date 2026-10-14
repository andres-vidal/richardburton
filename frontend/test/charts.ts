import type { Column } from "components/InsightColumns";
import type { Row } from "components/InsightTable";
import type { Group } from "modules/insights";

/**
 * A year or a decade of a chart over time. It has both the `at` of a column
 * and the `key` of a row, so it can be drawn as a column or a point, or listed
 * as a row.
 */
type Timed = Column & Row;

/** Returns the groups of a chart by year, each named by its year. */
const years = (groups: Group[]): Timed[] =>
  groups.map(({ key, counts }) => ({
    key: String(key),
    at: key as number,
    label: String(key),
    counts,
  }));

/** Returns the groups of a chart by decade, each named as "1950s". */
const decades = (groups: Group[]): Timed[] =>
  groups.map(({ key, counts }) => ({
    key: String(key),
    at: key as number,
    label: `${key}s`,
    counts,
  }));

export { decades, years };
