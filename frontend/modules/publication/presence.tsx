"use client";

import type { Awareness } from "y-protocols/awareness";
import {
  createContext,
  FC,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";

import type { LiveState, PresenceList } from "./document-live";
import type { SyncState } from "./document-sync";

/** Which cell somebody has focused. */
type At = { row: string; field: string };

/**
 * How many colours people are told apart by.
 *
 * A small fixed palette rather than a colour per person, since two people in a
 * document at once is the ordinary case. The colours themselves are in
 * `styles/globals.css`, one rule per index, so this count and that list have to
 * agree.
 */
const COLOURS = 5;

/**
 * Which colour this person is drawn in, the same one everywhere they appear.
 *
 * Taken from the address they signed in with rather than from the connection,
 * so it is the same colour tomorrow and in every tab. A colour that changed on
 * every reload would say nothing about who anybody is.
 */
const colourOf = (email: string) => {
  let hash = 0;
  for (let at = 0; at < email.length; at += 1) {
    hash = (hash * 31 + email.charCodeAt(at)) | 0;
  }

  return Math.abs(hash) % COLOURS;
};

/** How somebody is shown where there is only room for one character. */
const initial = (email: string) => email.slice(0, 1).toUpperCase();

/** Where to find whoever is in a given cell. */
const cellKey = (row: string, field: string) => `${row}:${field}`;

/**
 * Who else is here, and which cell each of them is in.
 *
 * Who is here comes from presence, which the server keeps; where they are comes
 * from awareness, which each client says for itself. A cursor is shown only for
 * a connection the server has, and under the address the server holds for it,
 * so a client can say where it is looking but not who it is.
 *
 * Kept outside React state so that a reader can subscribe to the one thing it
 * draws. A cell asks who is in it and is re-rendered only when that answer
 * changes, so somebody moving their cursor redraws the cell they left and the
 * one they entered, rather than every cell on the page.
 */
type Roster = {
  subscribe: (listener: () => void) => () => void;
  /** The address of whoever else is in this cell, if anybody is. */
  occupant: (key: string) => string | undefined;
  /**
   * Everyone else here, one address per person.
   *
   * One per person rather than per connection: somebody with the document open
   * in two tabs is one person, not two. The same array comes back while the
   * same people are here.
   */
  people: () => string[];
};

function rosterOf(awareness: Awareness, presence: PresenceList): Roster {
  const listeners = new Set<() => void>();
  let occupants = new Map<string, string>();
  let people: string[] = [];

  const read = () => {
    const connections = presence.connections();
    const nextOccupants = new Map<string, string>();

    awareness.getStates().forEach((state, clientId) => {
      const email = connections.get(clientId);
      if (clientId === awareness.clientID || !email) return;

      const { at } = state as { at?: At | null };

      // The first of them only: two people in one cell at once is rare enough
      // that showing both would cost more room than it is worth, and the point
      // is that somebody is there.
      const key = at ? cellKey(at.row, at.field) : undefined;
      if (key && !nextOccupants.has(key)) nextOccupants.set(key, email);
    });

    occupants = nextOccupants;

    const nextPeople = [
      ...new Set(
        [...connections]
          .filter(([clientId]) => clientId !== awareness.clientID)
          .map(([, email]) => email),
      ),
    ];
    const same =
      nextPeople.length === people.length &&
      nextPeople.every((email, index) => email === people[index]);

    if (!same) people = nextPeople;
  };

  const refresh = () => {
    read();
    listeners.forEach((listener) => listener());
  };

  // A change this client made to its own state says nothing about anybody
  // else, and this client is not on its own roster.
  const onChange = (_changes: unknown, origin: unknown) => {
    if (origin !== "local") refresh();
  };

  let leavePresence = () => {};

  read();

  return {
    subscribe: (listener) => {
      if (listeners.size === 0) {
        awareness.on("change", onChange);
        leavePresence = presence.subscribe(refresh);
        read();
      }

      listeners.add(listener);

      return () => {
        listeners.delete(listener);

        if (listeners.size === 0) {
          awareness.off("change", onChange);
          leavePresence();
        }
      };
    },
    occupant: (key) => occupants.get(key),
    people: () => people,
  };
}

/** A shared document as the surfaces inside it see it. */
type Live = { awareness: Awareness; roster: Roster };

/** How a shared document's work stands: whether it is live, and whether it is saved. */
type DocumentHealth = { connection: LiveState; saving: SyncState };

// Two contexts, because they change at different rates and are read by
// different things. Every cell reads the document, which is the same for as
// long as the document is open. Only the status reads its health, which changes
// whenever somebody starts or stops typing.
const LiveContext = createContext<Live | null>(null);
const HealthContext = createContext<DocumentHealth | null>(null);

/** Put a shared document, and how it stands, in reach of what is inside it. */
const LiveProvider: FC<{
  awareness: Awareness;
  presence: PresenceList;
  connection: LiveState;
  saving: SyncState;
  children: ReactNode;
}> = ({ awareness, presence, connection, saving, children }) => {
  const live = useMemo(
    () => ({ awareness, roster: rosterOf(awareness, presence) }),
    [awareness, presence],
  );

  const health = useMemo(() => ({ connection, saving }), [connection, saving]);

  return (
    <LiveContext.Provider value={live}>
      <HealthContext.Provider value={health}>{children}</HealthContext.Provider>
    </LiveContext.Provider>
  );
};

/**
 * The shared document this surface is part of, or `null` where it is not part
 * of one — the edit modal over the database is one person editing one record.
 */
function useDocument(): Live | null {
  return useContext(LiveContext);
}

/** How the shared document stands, or `null` where there is none. */
function useDocumentHealth(): DocumentHealth | null {
  return useContext(HealthContext);
}

// What a reader subscribes to where there is no document to hear from.
const nothingToHear = () => () => {};
const nobody: string[] = [];
const nobodyHere = () => nobody;

/** Everyone else who has this document open, one address per person. */
function useOthersPresent(): string[] {
  const roster = useDocument()?.roster;
  const read = roster?.people ?? nobodyHere;

  return useSyncExternalStore(roster?.subscribe ?? nothingToHear, read, read);
}

/** The address of whoever else has this cell focused, if anybody does. */
function useOnThisCell(row: string, field: string): string | undefined {
  const roster = useDocument()?.roster;
  const key = cellKey(row, field);
  const read = useCallback(() => roster?.occupant(key), [roster, key]);

  return useSyncExternalStore(roster?.subscribe ?? nothingToHear, read, read);
}

/**
 * Say which cell this person has moved to, or that they have left one.
 *
 * It rides awareness, so it is never written down: where somebody is looking is
 * true only while they are looking at it.
 */
function useReportPosition(): (at: At | null) => void {
  const awareness = useDocument()?.awareness;

  return useCallback(
    (at: At | null) => awareness?.setLocalStateField("at", at),
    [awareness],
  );
}

export {
  COLOURS,
  LiveProvider,
  colourOf,
  initial,
  useDocument,
  useDocumentHealth,
  useOnThisCell,
  useOthersPresent,
  useReportPosition,
};
export type { At, DocumentHealth, Live };
