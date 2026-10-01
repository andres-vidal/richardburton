import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
} from "y-protocols/awareness";
import * as Y from "yjs";

import {
  Publication,
  PublicationError,
  PublicationKey,
  empty,
} from "modules/publication/model";
import type { PresenceList } from "modules/publication/document-live";
import type { At } from "modules/publication/presence";
import { clearSelection } from "modules/selection";
import type { Store } from "modules/store";
import {
  createId,
  hydrate,
  resetAll,
  resetAttributes,
  setAll,
} from "modules/publication/store";

type SeedEntry = Partial<Publication> & { errors?: PublicationError };

/** Build a field-level error map (the backend only returns the invalid fields). */
function fieldErrors(
  errors: Partial<Record<PublicationKey, string>>,
): PublicationError {
  return errors as Record<PublicationKey, string>;
}

/** A few real English translations of Brazilian literature, for stories/tests. */
const SAMPLE_PUBLICATIONS: Partial<Publication>[] = [
  {
    originalTitle: "Dom Casmurro",
    originalAuthors: ["Machado de Assis"],
    title: "Dom Casmurro",
    authors: ["Helen Caldwell"],
    year: "1953",
    countries: ["US"],
    publishers: ["Noonday Press"],
  },
  {
    originalTitle: "A Hora da Estrela",
    originalAuthors: ["Clarice Lispector"],
    title: "The Hour of the Star",
    authors: ["Benjamin Moser"],
    year: "2011",
    countries: ["US"],
    publishers: ["New Directions"],
  },
  {
    originalTitle: "Grande Sertão: Veredas",
    originalAuthors: ["João Guimarães Rosa"],
    title: "The Devil to Pay in the Backlands",
    authors: ["James L. Taylor", "Harriet de Onís"],
    year: "1963",
    countries: ["US"],
    publishers: ["Knopf"],
  },
];

/**
 * Cycle the samples into `count` publications with light variation — for stories
 * that showcase overflow (a scrolling viewport) and the row virtualization.
 */
function sampleManyPublications(count: number): Partial<Publication>[] {
  return Array.from({ length: count }, (_, i) => {
    const base = SAMPLE_PUBLICATIONS[i % SAMPLE_PUBLICATIONS.length];
    return {
      ...base,
      title: `${base.title} #${i + 1}`,
      year: `${1950 + (i % 70)}`,
    };
  });
}

/**
 * Empty a store, and clear any selection or hidden columns left by a previous
 * story.
 */
function clear(store: Store): void {
  resetAll(store);
  clearSelection(store);
  // Column visibility survives resetAll (it's a UI preference in the app), so
  // reset it here too — otherwise a column hidden in one story stays hidden.
  resetAttributes(store);
}

/**
 * Reset a store and seed it with the given publications (defaults to samples),
 * as the rows of an import workspace. Each entry may carry an `errors` value to
 * render an invalid row.
 *
 * Takes the store so a story can seed the one it is about to hand its provider,
 * rather than a shared singleton.
 */
function seed(store: Store, entries: SeedEntry[] = SAMPLE_PUBLICATIONS): void {
  clear(store);
  setAll(
    store,
    entries.map(({ errors = null, ...publication }) => ({
      id: createId(),
      publication: { ...empty(), ...publication },
      errors,
    })),
  );
}

/**
 * Reset a store and seed it with the given publications (defaults to samples)
 * as saved publications, through `hydrate`. Use it for the read-only index,
 * which reads the saved copy of each row. Each publication gets a server id,
 * counting from one.
 */
function seedIndex(
  store: Store,
  entries: Partial<Publication>[] = SAMPLE_PUBLICATIONS,
): void {
  clear(store);
  hydrate(
    store,
    entries.map((publication, index) => ({
      ...empty(),
      ...publication,
      id: index + 1,
    })),
  );
}

/**
 * Build the awareness and presence of a shared document for a story to render
 * inside. `others` lists the other people in it and the cell each has focused.
 *
 * Each person gets their own connection, as if in their own tab. Presence
 * lists that connection under the person's email, and the person's focused
 * cell is applied to awareness as a remote update.
 */
function aDocumentWith(others: { email: string; at?: At }[] = []): {
  awareness: Awareness;
  presence: PresenceList;
} {
  const awareness = new Awareness(new Y.Doc());
  const connections = new Map<number, string>();

  others.forEach(({ email, at }) => {
    const theirs = new Awareness(new Y.Doc());
    theirs.setLocalState({ at });
    connections.set(theirs.clientID, email);

    applyAwarenessUpdate(
      awareness,
      encodeAwarenessUpdate(theirs, [theirs.clientID]),
      "elsewhere",
    );

    theirs.destroy();
  });

  return {
    awareness,
    presence: { subscribe: () => () => {}, connections: () => connections },
  };
}

export {
  SAMPLE_PUBLICATIONS,
  aDocumentWith,
  fieldErrors,
  sampleManyPublications,
  seed,
  seedIndex,
};
