"use client";

import { createContext, FC, ReactNode, useContext } from "react";
import type { WorldMap } from "./world-map";

const WorldMapContext = createContext<WorldMap | null>(null);

/**
 * Makes `map` available to `useWorldMap` in its children. The map does not
 * depend on what is counted, so it is meant to be computed once, on the
 * server, and provided above the parts of a page that change with a search.
 */
const WorldMapProvider: FC<{ map: WorldMap; children: ReactNode }> = ({
  map,
  children,
}) => <WorldMapContext value={map}>{children}</WorldMapContext>;

/**
 * Returns the map from the nearest `WorldMapProvider`. Throws when there is
 * none.
 */
function useWorldMap(): WorldMap {
  const map = useContext(WorldMapContext);

  if (!map) throw new Error("useWorldMap needs a WorldMapProvider above it");

  return map;
}

export { WorldMapProvider, useWorldMap };
