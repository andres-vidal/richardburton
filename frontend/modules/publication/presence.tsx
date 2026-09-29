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

/** The cell a person has focused, by row key and field. */
type At = { row: string; field: string };

/**
 * The number of presence colours.
 *
 * The palette is small and fixed rather than one colour per person, since a
 * document usually has two people in it at once. The colours are defined in
 * `styles/globals.css`, one rule per index, so this number must match the
 * number of rules there.
 */
const COLOURS = 5;

/**
 * Returns a person's colour index, computed from a hash of their email.
 *
 * The index depends on the email rather than on the connection, so a person
 * has the same colour in every tab and every session.
 */
const colourOf = (email: string) => {
  let hash = 0;
  for (let at = 0; at < email.length; at += 1) {
    hash = (hash * 31 + email.charCodeAt(at)) | 0;
  }

  return Math.abs(hash) % COLOURS;
};

/**
 * Returns the first letter of an email, upper-cased, for places with room for
 * one character.
 */
const initial = (email: string) => email.slice(0, 1).toUpperCase();

/** The key of a cell in the roster: `<row>:<field>`. */
const cellKey = (row: string, field: string) => `${row}:${field}`;

/**
 * The other people in a document, and the cell each of them has focused.
 *
 * The list of people comes from presence, which the server keeps. The focused
 * cells come from awareness, which each client sets for itself. A cursor is
 * shown only for a connection that presence lists, under the email presence
 * gives for it. A client can therefore set where its cursor is, but not whose
 * cursor it is.
 *
 * The roster is kept outside React state, so each component subscribes to the
 * one value it renders. A cell reads its occupant and re-renders only when the
 * occupant changes. When someone moves their cursor, only the cell they left
 * and the cell they entered re-render.
 */
type Roster = {
  subscribe: (listener: () => void) => () => void;
  /** The email of the other person who has this cell focused, if anyone. */
  occupant: (key: string) => string | undefined;
  /**
   * The emails of everyone else in the document, one per person.
   *
   * A person with the document open in two tabs appears once. The same array
   * is returned for as long as the same people are present.
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

      // Only the first person in a cell is kept. Two people in one cell at once
      // is rare, and showing both would take more room than it is worth.
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

  // A change with the origin `local` is this client changing its own state.
  // This client is not on its own roster, so the roster is not refreshed.
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

/**
 * A shared document's awareness and roster, as components inside it read them.
 */
type Live = { awareness: Awareness; roster: Roster };

/** A shared document's connection state and save state. */
type DocumentHealth = { connection: LiveState; saving: SyncState };

// There are two contexts because their values change at different rates. Every
// cell reads `LiveContext`, which stays the same while the document is open.
// Only the status reads `HealthContext`, which changes each time the connection
// or save state changes, such as when someone here starts or stops typing.
const LiveContext = createContext<Live | null>(null);
const HealthContext = createContext<DocumentHealth | null>(null);

/**
 * Provides a shared document's awareness, roster, connection state and save
 * state to its children.
 */
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
 * Returns the shared document this component is inside, or `null` outside one.
 * The edit modal over the database, for example, is not inside a shared
 * document.
 */
function useDocument(): Live | null {
  return useContext(LiveContext);
}

/**
 * Returns the shared document's connection and save state, or `null` outside
 * one.
 */
function useDocumentHealth(): DocumentHealth | null {
  return useContext(HealthContext);
}

// The subscribe and read functions used outside a shared document.
const nothingToHear = () => () => {};
const nobody: string[] = [];
const nobodyHere = () => nobody;

/**
 * Returns the emails of everyone else who has this document open, one per
 * person.
 */
function useOthersPresent(): string[] {
  const roster = useDocument()?.roster;
  const read = roster?.people ?? nobodyHere;

  return useSyncExternalStore(roster?.subscribe ?? nothingToHear, read, read);
}

/**
 * Returns the email of the other person who has this cell focused, if anyone
 * does.
 */
function useOnThisCell(row: string, field: string): string | undefined {
  const roster = useDocument()?.roster;
  const key = cellKey(row, field);
  const read = useCallback(() => roster?.occupant(key), [roster, key]);

  return useSyncExternalStore(roster?.subscribe ?? nothingToHear, read, read);
}

/**
 * Returns a function that sets this person's focused cell in awareness, or
 * clears it when given `null`.
 *
 * Awareness is relayed but not stored, so the focused cell is never saved.
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
