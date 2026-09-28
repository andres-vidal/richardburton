import { get } from "app/api";
import type { Insights } from "modules/insights";
import { cache } from "react";

/**
 * What the database holds, counted: all of it, or the publications a search
 * matches. Read where the page is rendered, so the figures arrive with it.
 */
export const readInsights = cache(async (search?: string): Promise<Insights> =>
  get<Insights>("/insights", { search }),
);
