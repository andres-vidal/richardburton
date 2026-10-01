"use client";

import { useAtomValue } from "jotai";
import {
  resemblanceSubjectAtom,
  visibleIdsAtom,
} from "modules/publication/store";
import { resemblances } from "modules/publication/remote";
import type { Store } from "modules/store";
import { FC, useEffect } from "react";

/** How long to wait after the last edit before checking the rows, in ms. */
const SETTLE = 500;

/**
 * Runs the look-alike check on all visible rows `SETTLE` ms after the last
 * change to a field the check reads or to the set of visible rows. It renders
 * nothing.
 *
 * It sends all visible rows, not only the row that changed, because each row is
 * also compared with the other rows. Editing one row can make it resemble
 * another row that has not changed.
 *
 * It checks the rows of the store it is given.
 */
const CheckResemblances: FC<{
  store: Store;
  /** Checks the rows. Defaults to `resemblances`, which asks the server. */
  check?: typeof resemblances;
}> = ({ store, check = resemblances }) => {
  // The fields the check reads, for every visible row, as a JSON string. The
  // atom can return a new array with the same contents, so the effect depends
  // on this string instead.
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
