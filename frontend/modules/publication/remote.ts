import { request } from "app";
import { AxiosError, AxiosInstance } from "axios";
import { notify } from "components/Notifications";
import { RESET } from "jotai/utils";
import type { Store } from "modules/store";
import hash from "object-hash";

import type { Publication, PublicationHistoryEntry } from "./model";
import {
  PublicationError,
  PublicationId,
  ValidationResult,
  describeError,
} from "./model";
import {
  createId,
  errorFamily,
  isValidatingAtom,
  lastValidatedFamily,
  overrideFamily,
  publicationFamily,
  publicationIdsAtom,
  removePublication,
  resetAll,
  setAll,
  setErrors,
  visibleIdsAtom,
  visiblePublicationFamily,
} from "./store";

/**
 * Whether a failed call was a composite-key conflict. `request` unwraps a 409
 * into the thrown string "conflict"; the raw AxiosError shape is also
 * accepted so tests can reject with either.
 */
function isConflict(error: unknown): boolean {
  return error === "conflict" || (error as AxiosError).response?.status === 409;
}

/**
 * Run a server call, surfacing a friendly notification on failure and
 * re-throwing so callers can react (e.g. reset a file input).
 */
async function run<T>(op: (http: AxiosInstance) => Promise<T>): Promise<T> {
  try {
    return await request(op);
  } catch (error) {
    const message = describeError(error as PublicationError) || error;
    notify({ message: message as string, level: "warning" });
    throw error;
  }
}

/**
 * Read the details of a named stretch of the index from the browser, for
 * infinite scroll. The first page is server-rendered; as the reader nears the
 * foot, the next stretch of the frozen ordering is asked for by id. The search
 * and the words it matched on ride along so a row matched on its sources
 * still says why, without the search being resolved again. Ids that no longer
 * resolve (removed since the ordering froze) simply come back absent.
 */
async function loadDetails(
  ids: PublicationId[],
  search: string | undefined,
  keywords: string[],
): Promise<Publication[]> {
  const { data } = await request((http) =>
    http.get<{ entries: Publication[] }>("publications", {
      params: {
        ids,
        ...(search ? { search } : {}),
        ...(keywords.length ? { keywords } : {}),
      },
    }),
  );
  return data.entries;
}

/** Submit the current (visible) working set. */
async function bulk(store: Store): Promise<Publication[]> {
  return run(async (http) => {
    const ids = store.get(visibleIdsAtom);
    const publications = ids?.map((id) =>
      store.get(visiblePublicationFamily(id)),
    );

    store.set(publicationIdsAtom, RESET);

    const { data } = await http.post<Publication[]>(
      "publications/bulk",
      publications,
    );
    return data;
  });
}

/**
 * Persist edits to a single publication (admin). Returns whether it succeeded;
 * on a conflict or validation error the row keeps its edits so they can be fixed.
 */
async function update(store: Store, id: PublicationId): Promise<boolean> {
  const publication = store.get(visiblePublicationFamily(id));

  try {
    const { data } = await request((http) =>
      http.put<Publication>(`publications/${id}`, publication),
    );

    // Replace the row with the server's canonical value and clear the edit.
    store.set(publicationFamily(id), data);
    store.set(overrideFamily(id), RESET);
    store.set(errorFamily(id), RESET);
    notify({
      message: "Publication updated",
      detail: `"${data.title}" is saved.`,
      level: "success",
    });
    return true;
  } catch (error) {
    const { response } = error as AxiosError<{ errors: PublicationError }>;

    if (isConflict(error)) {
      notify({
        message: describeError("conflict"),
        detail:
          "Change one of the keyed fields — title, year, countries, publishers or the original book.",
        level: "warning",
      });
    } else if (response?.status === 400) {
      // Field errors belong on the fields; the form shows them in place.
      store.set(errorFamily(id), response.data?.errors ?? null);
    } else {
      notify({
        message: "Could not save the publication",
        detail:
          "Your edits are still here. Check your connection and try again.",
        level: "warning",
      });
    }

    return false;
  }
}

/**
 * Delete a publication from the database (admin). The server soft-deletes —
 * the record leaves the index and search but stays restorable, and the change
 * lands in the publication history. Returns whether it succeeded.
 */
async function deletePublication(
  store: Store,
  { id, title }: { id: PublicationId; title: string },
): Promise<boolean> {
  try {
    await request((http) => http.delete(`publications/${id}`));

    removePublication(store, id);
    notify({
      message: "Publication deleted",
      detail: `“${title}” is out of the database. Restore it from Deleted publications.`,
      level: "success",
    });
    return true;
  } catch {
    notify({
      message: "Could not delete the publication",
      detail: `“${title}” is unchanged. Check your connection and try again.`,
      level: "warning",
    });
    return false;
  }
}

/**
 * Undo one recorded change (admin), naming the entry rather than describing the
 * result: the server decides which action compensates it and what state that
 * produces. A new entry lands in the log — history is never rewritten — so the
 * undo is itself undoable. Returns whether it succeeded.
 */
async function undo(
  id: PublicationId,
  version: PublicationHistoryEntry["version"],
): Promise<boolean> {
  try {
    await request((http) =>
      http.post(`publications/${id}/history/${version}/undo`),
    );

    notify({ message: "Change undone", level: "success" });
    return true;
  } catch (error) {
    notify({
      message: isConflict(error)
        ? "Could not undo — the record has moved on since"
        : "Could not undo the change",
      detail: isConflict(error)
        ? "A later change would be lost, or another publication now holds that data."
        : "Nothing changed. Check your connection and try again.",
      level: "warning",
    });
    return false;
  }
}

/**
 * Bring a deleted publication back into the database (admin). Returns whether
 * it succeeded; a conflict means the same record was imported again while this
 * one sat in the trash.
 */
async function restore(id: PublicationId): Promise<boolean> {
  try {
    await request((http) => http.post(`publications/${id}/restore`));

    notify({
      message: "Publication restored",
      detail: "It is back in the database and in search results.",
      level: "success",
    });
    return true;
  } catch (error) {
    notify({
      message: isConflict(error)
        ? "Could not restore — the record exists again"
        : "Could not restore the publication",
      detail: isConflict(error)
        ? "It was imported again while deleted, so restoring would duplicate it. Delete the newer copy first, or leave this one deleted."
        : "Nothing changed. Check your connection and try again.",
      level: "warning",
    });
    return false;
  }
}

/**
 * The publications a term finds, for a view that has to look one up while it is
 * open — the merge dialog searching for the duplicates of a record it is
 * showing. A failed search finds nothing rather than interrupting: the dialog
 * says so where the results would be.
 */
async function search(term: string): Promise<Publication[]> {
  try {
    const { data } = await request((http) =>
      http.get<{ entries: Publication[] }>("publications", {
        params: { search: term },
      }),
    );
    return data.entries;
  } catch {
    return [];
  }
}

/**
 * Collapse publications into one (admin). The survivor keeps its identity and
 * gains what the others hold; they leave the database recorded as merged.
 * Returns whether it succeeded — a conflict means the merged record would be
 * one that already exists.
 */
async function merge(
  store: Store,
  { winner, losers }: { winner: Publication; losers: Publication[] },
): Promise<boolean> {
  const ids = losers.map((loser) => loser.id!);

  try {
    await request((http) =>
      http.post(`publications/${winner.id}/merge`, { losers: ids }),
    );

    ids.forEach((id) => removePublication(store, id));
    notify({
      message: `Merged ${ids.length === 1 ? "1 publication" : `${ids.length} publications`}`,
      detail: `“${winner.title}” now holds what they said.`,
      level: "success",
    });
    return true;
  } catch (error) {
    notify({
      message: isConflict(error)
        ? "Could not merge — the result already exists"
        : "Could not merge the publications",
      detail: isConflict(error)
        ? "Another publication already holds what the merged record would. Merge that one instead."
        : "Nothing changed. Check your connection and try again.",
      level: "warning",
    });
    return false;
  }
}

/**
 * Record that these publications are not the same record twice (admin), so the
 * duplicate review stops offering them. Returns whether it succeeded.
 */
/**
 * Take back a ruling that records are different, so the review offers them
 * again. The reviewer changed their mind, or merged them since and undid it.
 */
async function reconsider(ids: PublicationId[]): Promise<boolean> {
  try {
    await request((http) =>
      http.post("publications/duplicates/reconsider", { publications: ids }),
    );

    notify({
      message: "Back among the questions",
      detail: "These will be offered as possible duplicates again.",
      level: "success",
    });
    return true;
  } catch {
    notify({
      message: "Could not put them back",
      detail: "Nothing changed. Check your connection and try again.",
      level: "warning",
    });
    return false;
  }
}

async function distinguish(ids: PublicationId[]): Promise<boolean> {
  try {
    await request((http) =>
      http.post("publications/duplicates/distinguish", { publications: ids }),
    );

    notify({
      message: "Kept apart",
      detail: "These will not be offered as duplicates again.",
      level: "success",
    });
    return true;
  } catch {
    notify({
      message: "Could not keep them apart",
      detail: "Nothing changed. Check your connection and try again.",
      level: "warning",
    });
    return false;
  }
}

/**
 * Live-validate a single publication's pending edits, excluding it from the
 * conflict check so an in-place edit doesn't collide with itself.
 */
async function validateUpdate(store: Store, id: PublicationId): Promise<void> {
  const publication = store.get(visiblePublicationFamily(id));
  const fingerprint = hash(publication);

  // Same dedup as `validate`: this runs on every blur (and on every change for
  // array fields), so a field the user only tabbed through costs no round-trip.
  if (fingerprint === store.get(lastValidatedFamily(id))) return;
  store.set(lastValidatedFamily(id), fingerprint);

  return run(async (http) => {
    const { data } = await http.post<ValidationResult>(
      `publications/${id}/validate`,
      publication,
    );
    setErrors(store, [{ ...data, id }]);
  });
}

/** Validate the given rows server-side, but only those whose value changed. */
async function validate(store: Store, ids: PublicationId[]): Promise<void> {
  return run(async (http) => {
    store.set(isValidatingAtom, true);
    try {
      const pending = ids
        .map((id) => ({
          id,
          publication: store.get(visiblePublicationFamily(id)),
        }))
        .map((entry) => ({ ...entry, hash: hash(entry.publication) }))
        .filter(({ id, hash: h }) => h !== store.get(lastValidatedFamily(id)))
        .map(({ id, publication, hash: h }) => {
          store.set(lastValidatedFamily(id), h);
          return { id, publication };
        });

      if (pending.length > 0) {
        const { data } = await http.post<ValidationResult[]>(
          "publications/validate",
          pending.map(({ publication }) => publication),
        );
        // Map results back to the rows we actually sent (the filtered set),
        // not the original id list.
        setErrors(
          store,
          data.map((entry, i) => ({ ...entry, id: pending[i].id })),
        );
      }
    } finally {
      // Always clear the flag, even if the request throws.
      store.set(isValidatingAtom, false);
    }
  });
}

/** Replace the working set from an uploaded CSV (validated server-side). */
async function upload(store: Store, payload: FormData): Promise<void> {
  return run(async (http) => {
    resetAll(store);
    try {
      const { data } = await http.post<ValidationResult[]>(
        "publications/validate",
        payload,
      );
      setAll(
        store,
        data.map((entry) => ({ ...entry, id: createId() })),
      );
    } catch (error) {
      setAll(store, []);
      throw error;
    }
  });
}

export {
  bulk,
  deletePublication,
  distinguish,
  loadDetails,
  merge,
  reconsider,
  restore,
  search,
  undo,
  update,
  upload,
  validate,
  validateUpdate,
};
