import { get, getOrNull, getWithHeaders } from "app/api";
import { getSession } from "app/session";
import { TOTAL_COUNT_HEADER } from "modules/api";
import { withChanges, type WithChanges } from "modules/publication/history";
import type {
  FollowedPublication,
  Matched,
  Publication,
  PublicationHistoryEntry,
  PublicationId,
  PublicationKind,
} from "modules/publication/model";
import type { PublicationIndex } from "modules/publication/store";
import { User } from "modules/users";
import { cache } from "react";

/**
 * One publication with what its reader may see of it: the record, its kind and
 * the publications it follows, and for a user who can edit publications, the
 * record's history.
 */
export type PublicationView = {
  publication: Publication;
  kind: PublicationKind;
  /** The publications this one follows, none for a first translation. */
  follows: FollowedPublication[];
  /** The record's history, present only for a user who can edit publications. */
  history?: WithChanges<PublicationHistoryEntry>[];
};

/** A publication as `GET /publications/:id` returns it. */
type PublicationRead = Publication & Pick<PublicationView, "kind" | "follows">;

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
      getOrNull<PublicationRead>(`/publications/${id}`, { search });

    if (!User.canEditPublications(session)) {
      const read = await readRecord();
      return read && viewOf(read);
    }

    const [read, history] = await Promise.all([
      readRecord(),
      getOrNull<{ entries: PublicationHistoryEntry[] }>(
        `/publications/${id}/history`,
      ),
    ]);

    return read && viewOf(read, withChanges(history?.entries ?? []));
  },
);

// Returns the view of `read`: the record without `kind` and `follows`, those
// two beside it, and `history` when it is given.
function viewOf(
  { kind, follows, ...publication }: PublicationRead,
  history?: WithChanges<PublicationHistoryEntry>[],
): PublicationView {
  return history
    ? { publication, kind, follows, history }
    : { publication, kind, follows };
}

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
