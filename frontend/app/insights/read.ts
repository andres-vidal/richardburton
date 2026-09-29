import { get } from "app/api";
import type { Insights } from "modules/insights";
import { cache } from "react";

/**
 * Fetches the insights for every publication, or for the ones a search
 * matches. It is called on the server while the insights page renders.
 */
export const readInsights = cache(async (search?: string): Promise<Insights> =>
  get<Insights>("/insights", { search }),
);
