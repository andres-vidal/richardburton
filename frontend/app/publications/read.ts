import { get, getOrNull, getWithHeaders } from "app/api";
import { getSession } from "app/session";
import { TOTAL_COUNT_HEADER } from "modules/api";
import { withChanges, type WithChanges } from "modules/publication/history";
import type {
  Matched,
  Publication,
  PublicationHistoryEntry,
  PublicationId,
} from "modules/publication/model";
import type { PublicationIndex } from "modules/publication/store";
import { User } from "modules/users";
import { cache } from "react";

/**
 * One publication with what its reader may see of it: the record, and for a
 * user who can edit publications, the record's history.
 */
export type PublicationView = {
  publication: Publication;
  /** The record's history, present only for a user who can edit publications. */
  history?: WithChanges<PublicationHistoryEntry>[];
};

/**
 * Reads a publication as the signed-in user, or returns `null` when the backend
 * answers 404 because the record never existed or has been deleted. Any other
 * failure is thrown. For a user who can edit publications, the record's history
 * is read at the same time as the record.
 */
export const readPublication = cache(
  async (id: string, search?: string): Promise<PublicationView | null> => {
    const session = await getSession();
    const readRecord = () =>
      getOrNull<Publication>(`/publications/${id}`, { search });

    if (!User.canEditPublications(session)) {
      const publication = await readRecord();
      return publication && { publication };
    }

    const [publication, history] = await Promise.all([
      readRecord(),
      getOrNull<{ entries: PublicationHistoryEntry[] }>(
        `/publications/${id}/history`,
      ),
    ]);

    return (
      publication && {
        publication,
        history: withChanges(history?.entries ?? []),
      }
    );
  },
);

export type { PublicationIndex };

// Reads `GET /publications` with `params` as a `PublicationIndex`. A response
// that is not paged, such as the unsourced queue, has no `order` or `perPage`.
// Its rows are then the whole order, and the whole page.
async function readDatabase(
  params: Record<string, unknown>,
): Promise<PublicationIndex> {
  const { data, headers } = await getWithHeaders<{
    entries: Publication[];
    matched?: Matched[];
    order?: PublicationId[];
    perPage?: number;
  }>("/publications", params);

  const total = headers[TOTAL_COUNT_HEADER];

  return {
    entries: data.entries,
    matched: data.matched ?? [],
    total: total === undefined ? null : parseInt(total),
    order: data.order ?? data.entries.map((entry) => entry.id!),
    perPage: data.perPage ?? data.entries.length,
  };
}

/**
 * Reads the first page of the database, for the search `search` or for every
 * publication. The later pages are read in the browser as the reader scrolls.
 */
export const readIndex = cache((search?: string) => readDatabase({ search }));

/** Reads the publications that cite no source yet, in the order to fill them. */
export const readUnsourced = cache(() => readDatabase({ unsourced: true }));

/** A set of records that look like one publication entered more than once. */
export type DuplicateCluster = {
  publications: Publication[];
  /** How alike the closest two of them are, between 0 and 1. */
  score: number;
};

/** The clusters of possible duplicates, and how alike values must be. */
type DuplicateReport = {
  clusters: DuplicateCluster[];
  /** The trigram similarity, between 0 and 1, above which values are alike. */
  threshold: number;
};

/** A pair someone has ruled apart, and the record of who did. */
export type Distinction = {
  publications: Publication[];
  actor: string;
  timestamp: string;
};

/** Reads the pairs already ruled apart, newest first. */
export const readDistinctions = cache(async (): Promise<Distinction[]> => {
  const { entries } = await get<{ entries: Distinction[] }>(
    "/publications/duplicates/distinctions",
  );

  return entries;
});

/** Reads the clusters of possible duplicates, likeliest first. */
export const readDuplicates = cache(async (): Promise<DuplicateReport> => {
  const { entries, threshold } = await get<{
    entries: DuplicateCluster[];
    threshold: number;
  }>("/publications/duplicates");

  return { clusters: entries, threshold };
});
