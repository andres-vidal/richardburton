"use client";

import { useAtomValue } from "jotai";
import { loadPage } from "modules/publication/remote";
import {
  appendIndex,
  isLoadingMoreAtom,
  matchingCountAtom,
  perPageAtom,
  publicationIdsAtom,
} from "modules/publication/store";
import { usePublicationStore } from "modules/publication/workspace";
import { useSearchParams } from "next/navigation";
import { FC, useCallback, useEffect, useRef } from "react";
import useVisible from "utils/useVisible";

/**
 * Grows the list as the reader nears the foot of it. The first page arrives with
 * the page, server-rendered; each further page is fetched here when a sentinel
 * below the last row comes into view, and appended to what is already loaded.
 *
 * A page is no longer a place — the reader scrolls rather than steps — so the
 * address carries only the search, and returning to a row means scrolling back
 * to it.
 */
const PublicationScroll: FC = () => {
  const store = usePublicationStore();
  const search = useSearchParams()?.get("search") ?? undefined;

  const loaded = useAtomValue(publicationIdsAtom)?.length ?? 0;
  const matching = useAtomValue(matchingCountAtom);
  const perPage = useAtomValue(perPageAtom);
  const loading = useAtomValue(isLoadingMoreAtom);

  const more = perPage > 0 && loaded < matching;

  const sentinel = useRef<HTMLDivElement>(null);
  // Reach for the next page before the foot is in view, so the rows are usually
  // there by the time the reader arrives.
  const nearingEnd = useVisible(sentinel, "800px");

  const loadMore = useCallback(async () => {
    // Read the live counts, not the render's: a lingering sentinel must not ask
    // for a page already in flight, nor for one past the end.
    if (store.get(isLoadingMoreAtom)) return;

    const have = store.get(publicationIdsAtom)?.length ?? 0;
    const size = store.get(perPageAtom);
    if (size <= 0 || have >= store.get(matchingCountAtom)) return;

    store.set(isLoadingMoreAtom, true);
    try {
      appendIndex(store, await loadPage(search, Math.floor(have / size) + 1));
    } finally {
      store.set(isLoadingMoreAtom, false);
    }
  }, [store, search]);

  useEffect(() => {
    if (nearingEnd && more && !loading) loadMore();
  }, [nearingEnd, more, loading, loadMore]);

  return more || loading ? (
    <div
      ref={sentinel}
      aria-live="polite"
      className="py-6 text-sm text-center text-gray-600"
    >
      {loading ? "Loading more…" : ""}
    </div>
  ) : null;
};

export default PublicationScroll;
