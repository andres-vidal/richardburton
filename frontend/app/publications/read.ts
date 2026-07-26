import { get } from "app/api";
import { getSession } from "app/session";
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
 *
 * `cache` memoises for the lifetime of the render, so a page, its metadata, and
 * its heading asking the same question cost one round trip.
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
    if (!session || !User.isAdmin(session.role)) return { publication };

    const { entries } = await get<{ entries: PublicationHistoryEntry[] }>(
      `/publications/${id}/history`,
    );

    return { publication, history: withChanges(entries) };
  },
);
