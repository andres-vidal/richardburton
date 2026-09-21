"use client";

import type { Awareness } from "y-protocols/awareness";
import { createContext, useContext, useEffect, useState } from "react";

/** Someone who has this document open, as they say who they are. */
type Present = { clientId: number; email: string };

type Live = {
  /** Who is here, or nothing where the surface is not connected. */
  awareness?: Awareness;
};

const LiveContext = createContext<Live>({});

const LiveProvider = LiveContext.Provider;

/**
 * Everyone else who has this document open.
 *
 * Read from awareness rather than from the server, because it is true only
 * while someone is looking: it is never written down, and a person who closes
 * the tab is simply no longer in it.
 *
 * This person is left out — a list of who is here is about the others.
 */
function useOthersPresent(): Present[] {
  const { awareness } = useContext(LiveContext);
  const [present, setPresent] = useState<Present[]>([]);

  useEffect(() => {
    if (!awareness) return;

    const read = () =>
      setPresent(
        [...awareness.getStates().entries()]
          .filter(([clientId]) => clientId !== awareness.clientID)
          .map(([clientId, state]) => ({
            clientId,
            email: (state as { user?: { email?: string } })?.user?.email ?? "",
          }))
          .filter(({ email }) => email !== ""),
      );

    read();
    awareness.on("change", read);

    return () => awareness.off("change", read);
  }, [awareness]);

  return present;
}

export { LiveProvider, useOthersPresent };
export type { Live, Present };
