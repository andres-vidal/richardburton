"use client";

import { useAtomValue } from "jotai";
import { loadDetails } from "modules/publication/remote";
import {
  appendIndex,
  drawnCountAtom,
  isLoadingMoreAtom,
  orderAtom,
  perPageAtom,
} from "modules/publication/store";
import { usePublicationStore } from "modules/publication/workspace";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { FC, useCallback } from "react";
import useOnVisible from "utils/useOnVisible";

/**
 * Grows the list as the reader nears the foot of it. The first response holds
 * the whole ordering, the ids of every match in reading order, and the first
 * page of them in full. When a sentinel below the last row comes within 800px
 * of the viewport, this reads the next stretch of that ordering by id and
 * appends it to the store. It renders the sentinel while there is more to read,
 * with a spinner while a stretch is being read, and nothing once every row is
 * loaded.
 *
 * Because the ordering is fixed, paging cannot drift as the database changes
 * underneath. The address carries only the search, not a page.
 */
const PublicationScroll: FC = () => {
  const t = useTranslations("common");
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
      const entries = await loadDetails(next, search);
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
          {t("loadingMore")}
        </>
      )}
    </div>
  ) : null;
};

export default PublicationScroll;
