"use client";

import { useAtomValue } from "jotai";
import {
  resemblanceSubjectAtom,
  visibleIdsAtom,
} from "modules/publication/store";
import { resemblances } from "modules/publication/remote";
import type { Store } from "modules/store";
import { FC, useEffect } from "react";

/** How long the rows must sit still before they are measured. */
const SETTLE = 500;

/**
 * Keeps every row's look-alikes current as the rows are edited.
 *
 * The whole set goes over at once rather than the row that changed, because a
 * row is measured against the others as well as against the database: editing
 * one row can make it the twin of another, and neither is stored for a query to
 * find them by.
 *
 * Rendered by the surface that holds the rows and given its store, the way
 * `ClearSelection` is, so it measures the rows it was mounted beside.
 */
const CheckResemblances: FC<{
  store: Store;
  /** How the rows are measured. Defaults to asking the server. */
  check?: typeof resemblances;
}> = ({ store, check = resemblances }) => {
  // The fields the answer depends on. Rebuilt on every edit, so what is watched
  // is its contents: a change anywhere else leaves this string alone.
  const subject = JSON.stringify(useAtomValue(resemblanceSubjectAtom));

  useEffect(() => {
    const ids = store.get(visibleIdsAtom) ?? [];
    if (ids.length === 0) return;

    const timer = setTimeout(() => check(store, ids), SETTLE);

    return () => clearTimeout(timer);
  }, [subject, store, check]);

  return null;
};

export default CheckResemblances;
