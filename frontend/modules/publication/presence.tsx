"use client";

import type { Awareness } from "y-protocols/awareness";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/** Which cell somebody has focused. */
type At = { row: string; field: string };

/** Someone who has this document open, as they say who they are. */
type Present = { clientId: number; email: string; at?: At };

/**
 * How many colours people are told apart by.
 *
 * A small fixed palette rather than a colour per person: the styles are static
 * classes, and two people in a document at once is the ordinary case.
 */
const COLOURS = 5;

/** Which colour this person is drawn in, the same one everywhere they appear. */
const colourOf = (clientId: number) => Math.abs(clientId) % COLOURS;

type Live = {
  /** Who is here, or nothing where the surface is not connected. */
  awareness?: Awareness;
};

const LiveContext = createContext<Live>({});

const LiveProvider = LiveContext.Provider;

/**
 * Everyone else who has this document open, one entry per person.
 *
 * Awareness counts *connections*, and one person may have the document open in
 * several tabs, so entries are folded together by the address they signed in
 * with. Otherwise one person reading in two tabs looks like two people.
 */
function useOthersPresent(): Present[] {
  const connections = useConnections();

  return useMemo(() => {
    const byPerson = new Map<string, Present>();

    connections.forEach((person) => {
      // Whichever of their connections is somewhere is the one worth keeping,
      // since that is the one saying where they are.
      const held = byPerson.get(person.email);
      if (!held || (!held.at && person.at)) byPerson.set(person.email, person);
    });

    return [...byPerson.values()];
  }, [connections]);
}

/**
 * Every connection to this document but this one.
 *
 * One per tab rather than one per person, which is what a cell needs: two tabs
 * of one person are in two different cells.
 */
function useConnections(): Present[] {
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
            at: (state as { at?: At })?.at,
          }))
          .filter(({ email }) => email !== ""),
      );

    read();
    awareness.on("change", read);

    return () => awareness.off("change", read);
  }, [awareness]);

  return present;
}

/**
 * Who else has this cell focused, if anyone.
 *
 * Only the first of them: two people in one cell at once is rare enough that
 * showing them all would cost more room than it is worth, and the point is that
 * somebody is there.
 */
function useOnThisCell(row: string, field: string): Present | undefined {
  return useConnections().find(
    (person) => person.at?.row === row && person.at?.field === field,
  );
}

/**
 * Say which cell this person has moved to, or that they have left one.
 *
 * It rides awareness, so it is never written down: where somebody is looking is
 * true only while they are looking at it.
 */
function useReportPosition(): (at: At | null) => void {
  const { awareness } = useContext(LiveContext);

  return useCallback(
    (at: At | null) => awareness?.setLocalStateField("at", at),
    [awareness],
  );
}

export {
  COLOURS,
  LiveProvider,
  colourOf,
  useOnThisCell,
  useOthersPresent,
  useReportPosition,
};
export type { At, Live, Present };
