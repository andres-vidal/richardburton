import { Publication, PublicationError, PublicationKey, empty } from "./model";
import { createId, resetAll, resetAttributes, setAll } from "./store";

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
    originalAuthors: "Machado de Assis",
    title: "Dom Casmurro",
    authors: "Helen Caldwell",
    year: "1953",
    countries: "US",
    publishers: "Noonday Press",
  },
  {
    originalTitle: "A Hora da Estrela",
    originalAuthors: "Clarice Lispector",
    title: "The Hour of the Star",
    authors: "Benjamin Moser",
    year: "2011",
    countries: "US",
    publishers: "New Directions",
  },
  {
    originalTitle: "Grande Sertão: Veredas",
    originalAuthors: "João Guimarães Rosa",
    title: "The Devil to Pay in the Backlands",
    authors: "James L. Taylor, Harriet de Onís",
    year: "1963",
    countries: "US",
    publishers: "Knopf",
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
 * Reset the store and seed it with the given publications (defaults to
 * samples). Each entry may carry an `errors` value to render an invalid row.
 */
function seed(entries: SeedEntry[] = SAMPLE_PUBLICATIONS): void {
  resetAll();
  // Column visibility survives resetAll (it's a UI preference in the app), so
  // reset it here too — otherwise a column hidden in one story stays hidden.
  resetAttributes();
  setAll(
    entries.map(({ errors = null, ...publication }) => ({
      id: createId(),
      publication: { ...empty(), ...publication },
      errors,
    })),
  );
}

export { SAMPLE_PUBLICATIONS, fieldErrors, sampleManyPublications, seed };
