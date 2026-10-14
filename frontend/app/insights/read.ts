import { get } from "app/api";
import type { ChartParams } from "modules/chart";
import type { Insights } from "modules/insights";
import { cache } from "react";

/**
 * Fetches the insights for every publication, or for the ones a search
 * matches, with the chart that `chart` asks for.
 */
export const readInsights = cache(
  async (search: string | undefined, chart: ChartParams): Promise<Insights> =>
    get<Insights>("/insights", { search, ...chart }),
);
