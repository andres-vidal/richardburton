"use client";

import { useAtomValue } from "jotai";
import { loadDetails } from "modules/publication/remote";
import {
  appendIndex,
  drawnCountAtom,
  isLoadingMoreAtom,
  keywordsAtom,
  orderAtom,
  perPageAtom,
} from "modules/publication/store";
import { usePublicationStore } from "modules/publication/workspace";
import { useSearchParams } from "next/navigation";
import { FC, useCallback } from "react";
import useOnVisible from "utils/useOnVisible";

/**
 * Grows the list as the reader nears the foot of it. The first response hands
 * back the whole ordering — the ids of every match, in reading order — and the
 * first page of them in full. Each further page is fetched here when a sentinel
 * below the last row scrolls into view: the next stretch of that frozen
 * ordering, asked for by id and appended to what is already loaded.
 *
 * Because the ordering is fixed, paging cannot drift as the database changes
 * underneath; and a page is no longer a place — the reader scrolls rather than
 * steps — so the address carries only the search, and returning to a row means
 * scrolling back to it.
 */
const PublicationScroll: FC = () => {
  const store = usePublicationStore();
  const search = useSearchParams()?.get("search") ?? undefined;

  const drawn = useAtomValue(drawnCountAtom);
  const total = useAtomValue(orderAtom).length;
  const loading = useAtomValue(isLoadingMoreAtom);

  const more = drawn < total;

  const loadMore = useCallback(async () => {
    // Read the live values, not the render's: a lingering sentinel must not ask
    // for a stretch already in flight, nor for one past the end.
    if (store.get(isLoadingMoreAtom)) return;

    const order = store.get(orderAtom);
    const from = store.get(drawnCountAtom);
    const size = store.get(perPageAtom);
    const next = order.slice(from, from + size);
    if (size <= 0 || next.length === 0) return;

    store.set(isLoadingMoreAtom, true);
    try {
      const entries = await loadDetails(next, search, store.get(keywordsAtom) ?? []);
      // A new query may have answered while this was in flight, replacing the
      // ordering these rows belong to; they are stale, so drop them.
      if (store.get(orderAtom) !== order) return;

      appendIndex(store, entries);
      // Advance past the whole stretch, so a removed id is stepped over rather
      // than blocking the ones behind it. A failed fetch throws before this and
      // leaves the cursor where it was, to be retried.
      store.set(drawnCountAtom, from + next.length);
    } catch {
      // The list simply does not grow; the sentinel stays and tries again.
    } finally {
      store.set(isLoadingMoreAtom, false);
    }
  }, [store, search]);

  // Reach for the next page before the foot is in view, so the rows are usually
  // there by the time the reader arrives. The observer calls loadMore itself.
  const sentinelRef = useOnVisible<HTMLDivElement>(loadMore, "800px");

  return more || loading ? (
    <div
      ref={sentinelRef}
      aria-live="polite"
      className="flex items-center justify-center gap-2 py-6 text-sm text-gray-600"
    >
      {loading && (
        <>
          <span className="w-4 h-4 border-2 rounded-full border-gray-300 border-t-indigo-500 animate-spin" />
          Loading more…
        </>
      )}
    </div>
  ) : null;
};

export default PublicationScroll;
