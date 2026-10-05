import type { Store } from "modules/store";
import hash from "object-hash";
import type * as Y from "yjs";

import * as Doc from "./doc";
import type { PublicationId } from "./model";
import { REMOTE, validate } from "./remote";
import { publicationIdsAtom, resemblanceSubjectAtom } from "./store";

/** How long to wait after this client's last edit before checking it, in ms. */
const SETTLE = 500;

/**
 * How long to wait after the last change from another client before checking
 * what is still unchecked, in ms. It is longer than `SETTLE` plus a request, so
 * the client that made the change normally stores its results first.
 */
const FALLBACK = 3000;

/** The checks of one import document. See `watchChecks`. */
type Checks = {
  /** Checks every row again, whatever results the document holds. */
  refresh: () => void;
  /** Stops watching the document and cancels any check not yet started. */
  stop: () => void;
};

/**
 * Keeps the checks of an import document up to date: validation, and the
 * look-alike check.
 *
 * The client that edits the document checks the edit. `SETTLE` ms after this
 * client's last edit, it validates the rows it changed that the document still
 * holds, and runs the look-alike check when the subject of the rows differs
 * from the one the stored results were measured on. The results are stored in
 * the document (see `setErrors` and `setResemblances`), so the other clients
 * read them and do not send the same requests.
 *
 * A change from another client is left to that client at first. `FALLBACK` ms
 * after the last such change, this client checks whatever is still out of
 * date: every row whose content has no stored result, and the look-alike check
 * when its subject is out of date. This covers two people
 * editing one row at once, and a client that closed before it stored its
 * results. Changes from other clients are ignored until `refresh` is first
 * called, since `refresh` checks everything anyway.
 *
 * A failed request is ignored here. The row keeps its old result, and is
 * checked again by the next change or the next `refresh`.
 */
function watchChecks(
  store: Store,
  doc: Y.Doc,
  { settle = SETTLE, fallback = FALLBACK } = {},
): Checks {
  const edited = new Set<PublicationId>();
  let own: ReturnType<typeof setTimeout> | undefined;
  let others: ReturnType<typeof setTimeout> | undefined;
  let refreshed = false;

  // The key of the subject of the look-alike check in flight, so that a second
  // trigger for the same subject does not send it again.
  let measuring: string | undefined;

  const all = () => store.get(publicationIdsAtom) ?? [];

  const measure = (force: boolean) => {
    const ids = all();
    const subject = hash(store.get(resemblanceSubjectAtom));

    if (ids.length === 0) return;
    if (!force && subject === Doc.checkedSubject(doc)) return;
    if (subject === measuring) return;

    measuring = subject;
    REMOTE.resemblances(store, ids)
      .catch(() => {})
      .finally(() => {
        if (measuring === subject) measuring = undefined;
      });
  };

  const checkOwn = () => {
    own = undefined;
    const ids = [...edited].filter((id) => Doc.holds(doc, id));
    edited.clear();

    if (ids.length > 0) validate(store, ids).catch(() => {});
    measure(false);
  };

  const checkRest = () => {
    others = undefined;

    validate(store, all()).catch(() => {});
    measure(false);
  };

  const onEdit = () => {
    clearTimeout(own);
    own = setTimeout(checkOwn, settle);
  };

  const onOther = () => {
    if (!refreshed) return;

    clearTimeout(others);
    others = setTimeout(checkRest, fallback);
  };

  const stopObserving = Doc.observe(doc, {
    onRows: (changed, edit) => {
      if (!edit) return onOther();

      changed.forEach((id) => edited.add(id));
      onEdit();
    },
    onOrder: (edit) => (edit ? onEdit() : onOther()),
  });

  return {
    refresh: () => {
      refreshed = true;

      validate(store, all(), { force: true }).catch(() => {});
      measure(true);
    },
    stop: () => {
      clearTimeout(own);
      clearTimeout(others);
      stopObserving();
    },
  };
}

export { FALLBACK, SETTLE, watchChecks };
export type { Checks };
