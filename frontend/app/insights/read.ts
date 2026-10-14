import { get } from "app/api";
import type { ChartParams } from "modules/chart";
import type { Insights } from "modules/insights";

/**
 * Fetches the insights for every publication, or for the ones a search
 * matches, with the chart that `chart` asks for.
 */
export const readInsights = (
  search: string | undefined,
  chart: ChartParams,
): Promise<Insights> => get<Insights>("/insights", { search, ...chart });
