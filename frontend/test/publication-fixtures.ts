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
  type PublicationEntry,
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
  setResemblances,
} from "modules/publication/store";

type SeedEntry = Partial<Publication> & { errors?: PublicationError };

/**
 * Returns `errors` as a row's field errors, which name only the invalid
 * fields, as the backend's do.
 */
function fieldErrors(
  errors: Partial<Record<PublicationKey, string>>,
): PublicationError {
  return errors as Record<PublicationKey, string>;
}

/** Three real English translations of Brazilian books. */
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
 * Returns `count` publications made from the samples in turn, each with its
 * number in the title and its own year, for stories with more rows than fit.
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

// Empties `store`, and clears the selection and the hidden columns a previous
// story left. `resetAll` keeps the hidden columns, so they are reset apart.
function clear(store: Store): void {
  resetAll(store);
  clearSelection(store);
  resetAttributes(store);
}

/**
 * Empties `store` and fills it with `entries`, the samples by default, as the
 * rows of an import workspace. An entry's `errors` makes its row invalid.
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
 * Empties `store` and fills it with `entries`, the samples by default, as
 * saved publications, through `hydrate`, for the read-only index. Each gets a
 * server id, counting from one.
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
 * Returns the awareness and presence of a shared document for a story to
 * render inside. `others` lists the other people in it and the cell each has
 * focused.
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

/** A stored record that the look-alike rows resemble. */
const LOOK_ALIKE_RECORD: Publication = {
  ...empty(),
  id: 7,
  title: "Dom Casmurro",
  authors: ["Helen Caldwell"],
  originalTitle: "Dom Casmurro",
  originalAuthors: ["Machado de Assis"],
  year: "1953",
  countries: ["US"],
  publishers: ["Noonday Press"],
};

/**
 * Three rows being imported. The first is a near-copy of `LOOK_ALIKE_RECORD`,
 * and the other two are near-copies of each other.
 */
const LOOK_ALIKE_ROWS: PublicationEntry[] = [
  {
    id: createId(),
    errors: null,
    publication: { ...LOOK_ALIKE_RECORD, id: null, title: "Dom Casmuro" },
  },
  {
    id: createId(),
    errors: null,
    publication: {
      ...empty(),
      title: "The Devil to Pay in the Backlands",
      authors: ["James L. Taylor"],
      originalTitle: "Grande Sertão: Veredas",
      originalAuthors: ["João Guimarães Rosa"],
      year: "1963",
      countries: ["US"],
      publishers: ["Knopf"],
    },
  },
  {
    id: createId(),
    errors: null,
    publication: {
      ...empty(),
      title: "The Devil to Pay in the Backland",
      authors: ["James L Taylor"],
      originalTitle: "Grande Sertao Veredas",
      originalAuthors: ["João Guimarães Rosa"],
      year: "1963",
      countries: ["US"],
      publishers: ["Knopf"],
    },
  },
];

/** The ids of `LOOK_ALIKE_ROWS`, in order. */
const LOOK_ALIKE_IDS = LOOK_ALIKE_ROWS.map(({ id }) => id);

/**
 * Empties a store and seeds it with `LOOK_ALIKE_ROWS`, together with the
 * look-alike check result the server would return for them: the first row
 * resembles `LOOK_ALIKE_RECORD`, and the other two resemble each other.
 */
function seedLookAlikes(store: Store): void {
  clear(store);
  setAll(store, LOOK_ALIKE_ROWS);
  setResemblances(
    store,
    LOOK_ALIKE_IDS,
    new Map([
      [
        LOOK_ALIKE_IDS[0],
        { stored: [LOOK_ALIKE_RECORD], others: [], repeats: null },
      ],
      [
        LOOK_ALIKE_IDS[1],
        { stored: [], others: [LOOK_ALIKE_IDS[2]], repeats: null },
      ],
      [
        LOOK_ALIKE_IDS[2],
        { stored: [], others: [LOOK_ALIKE_IDS[1]], repeats: null },
      ],
    ]),
  );
}

export {
  aDocumentWith,
  fieldErrors,
  sampleManyPublications,
  seed,
  seedIndex,
  LOOK_ALIKE_IDS,
  LOOK_ALIKE_RECORD,
  seedLookAlikes,
};
