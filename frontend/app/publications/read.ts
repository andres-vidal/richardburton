import { get, getWithHeaders } from "app/api";
import { getSession } from "app/session";
import { TOTAL_COUNT_HEADER } from "modules/api";
import { withChanges, type WithChanges } from "modules/publication/history";
import type {
  Publication,
  PublicationHistoryEntry,
} from "modules/publication/model";
import { User } from "modules/users";
import { cache } from "react";

/**
 * One publication with everything its reader is allowed to see: the record, and
 * for an admin the mutation log behind it. Both are read together so a view
 * renders complete instead of filling in after it is on screen.
 */
export type PublicationView = {
  publication: Publication;
  /** Present only for an admin — nobody else may read the log. */
  history?: WithChanges<PublicationHistoryEntry>[];
};

/**
 * Read a publication as the signed-in user, or `null` when there is nothing to
 * show — the record never existed, or has been deleted. Callers decide what that
 * means: a page answers 404, an overlay says the link is stale.
 */
export const readPublication = cache(
  async (id: string): Promise<PublicationView | null> => {
    const [publication, session] = await Promise.all([
      get<Publication>(`/publications/${id}`).catch(() => null),
      getSession(),
    ]);

    if (!publication) return null;

    // The log is admin-only, so asking for it as anyone else would only earn a
    // 401. Read it alongside the record rather than on a click: a change is part
    // of what the record *is*, not a detail to go fetch.
    if (!User.administers(session)) return { publication };

    const { entries } = await get<{ entries: PublicationHistoryEntry[] }>(
      `/publications/${id}/history`,
    );

    return { publication, history: withChanges(entries) };
  },
);

/**
 * A page of the catalogue: the rows, the keywords the search matched on, and how
 * many publications exist in total — which the index reports in a header rather
 * than in the body.
 */
export type PublicationIndex = {
  entries: Publication[];
  keywords: string[];
  total: number | null;
};

/**
 * Read the catalogue for a query, or the whole of it. This is the page's own
 * content, so it is read where the page is rendered — the reader gets rows in
 * the first response instead of an empty table and a spinner.
 */
export const readIndex = cache(
  async (search?: string): Promise<PublicationIndex> => {
    const query = search ? `?search=${encodeURIComponent(search)}` : "";
    const { data, headers } = await getWithHeaders<{
      entries: Publication[];
      keywords?: string[];
    }>(`/publications${query}`);

    const total = headers[TOTAL_COUNT_HEADER];

    return {
      entries: data.entries,
      keywords: data.keywords ?? [],
      total: total === undefined ? null : parseInt(total),
    };
  },
);

/**
 * The publications with no sources yet — the queue the backfill wizard steps
 * through, in the order it will offer them.
 */
export const readUnreferenced = cache(async (): Promise<PublicationIndex> => {
  const { data, headers } = await getWithHeaders<{ entries: Publication[] }>(
    "/publications?unreferenced",
  );

  const total = headers[TOTAL_COUNT_HEADER];

  return {
    entries: data.entries,
    keywords: [],
    total: total === undefined ? null : parseInt(total),
  };
});
