import type { Column } from "components/InsightColumns";
import type { Group } from "modules/insights";

/** Returns the groups of a chart by year, each named by its year. */
const years = (groups: Group[]): Column[] =>
  groups.map(({ key, counts }) => ({
    key: String(key),
    at: key as number,
    label: String(key),
    counts,
  }));

/** Returns the groups of a chart by decade, each named as "1950s". */
const decades = (groups: Group[]): Column[] =>
  groups.map(({ key, counts }) => ({
    key: String(key),
    at: key as number,
    label: `${key}s`,
    counts,
  }));

export { decades, years };
