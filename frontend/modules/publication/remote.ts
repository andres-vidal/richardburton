import { pick } from "lodash";
import { request } from "app";
import { AxiosError, AxiosInstance } from "axios";
import { notify } from "components/Notifications";
import { RESET } from "jotai/utils";
import type { Store } from "modules/store";

import type { Publication, PublicationHistoryEntry } from "./model";
import {
  PublicationError,
  PublicationId,
  Resemblance,
  ValidationResult,
  errorCode,
} from "./model";

/**
 * One entry of the resemblances response. `position`, `others` and `repeats`
 * are indexes into the list of rows the request sent.
 */
type ResemblanceEntry = Omit<Resemblance, "others" | "repeats"> & {
  position: number;
  others: number[];
  repeats: number | null;
};
import * as Doc from "./doc";
import {
  append,
  contentKey,
  createId,
  documentOf,
  errorFamily,
  lastValidatedFamily,
  publicationFamily,
  publicationIdsAtom,
  RESEMBLANCE_ATTRIBUTES,
  remember,
  removePublication,
  resemblanceSubjectAtom,
  rowSubjectFamily,
  setErrors,
  setResemblances,
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
    const code = errorCode(error as PublicationError);
    notify({
      message: code ? `publicationError.${code}` : String(error),
      level: "warning",
    });
    throw error;
  }
}

/** The publications with the given ids. Ids that no longer resolve come back absent. */
async function loadDetails(
  ids: PublicationId[],
  search: string | undefined,
): Promise<Publication[]> {
  const { data } = await request((http) =>
    http.get<{ entries: Publication[] }>("publications", {
      params: { ids, search },
    }),
  );
  return data.entries;
}

/**
 * Inserts the rows of the workspace, and returns the stored publications. The
 * rows stay in the workspace while the request runs, and after it fails.
 */
async function bulk(store: Store): Promise<Publication[]> {
  return run(async (http) => {
    const ids = store.get(publicationIdsAtom);
    const publications = ids?.map((id) => store.get(publicationFamily(id)));

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
  const publication = store.get(publicationFamily(id));

  try {
    const { data } = await request((http) =>
      http.put<Publication>(`publications/${id}`, publication),
    );

    // Store the server's value as both the saved copy and the row.
    remember(store, data);
    store.set(errorFamily(id), RESET);
    notify({
      message: "notify.publicationUpdated",
      detail: "notify.publicationUpdatedDetail",
      values: { title: data.title },
      level: "success",
    });
    return true;
  } catch (error) {
    const { response } = error as AxiosError<{ errors: PublicationError }>;

    if (isConflict(error)) {
      notify({
        message: "publicationError.conflict",
        detail: "notify.conflictDetail",
        level: "warning",
      });
    } else if (response?.status === 400) {
      // Field errors belong on the fields; the form shows them in place.
      store.set(errorFamily(id), response.data?.errors ?? null);
    } else {
      notify({
        message: "notify.saveFailed",
        detail: "notify.saveFailedDetail",
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
      message: "notify.publicationDeleted",
      detail: "notify.publicationDeletedDetail",
      values: { title },
      level: "success",
    });
    return true;
  } catch {
    notify({
      message: "notify.deleteFailed",
      detail: "notify.deleteFailedDetail",
      values: { title },
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

    notify({ message: "notify.changeUndone", level: "success" });
    return true;
  } catch (error) {
    notify({
      message: isConflict(error) ? "notify.undoOutpaced" : "notify.undoFailed",
      detail: isConflict(error)
        ? "notify.undoOutpacedDetail"
        : "notify.nothingChanged",
      level: "warning",
    });
    return false;
  }
}

/**
 * What a restore came to. `identical` means another publication that is not
 * deleted has the same identity, and `twin` is that publication. Nothing was
 * restored then.
 */
type Restoration =
  | { outcome: "restored" }
  | { outcome: "identical"; twin: Publication }
  | { outcome: "failed" };

/**
 * Bring a deleted publication back into the database (admin). When `changes`
 * are given, the server applies them to the publication before restoring it.
 *
 * A success and a failure are notified here. An `identical` outcome is not,
 * since the caller offers to restore the publication with changes.
 */
async function restore(
  id: PublicationId,
  changes?: Publication,
): Promise<Restoration> {
  try {
    const { status, data } = await request((http) =>
      http.post<{ error?: string; publication?: Publication } | "">(
        `publications/${id}/restore`,
        changes,
        // A 409 that names the identical publication is an answer to show,
        // not an error, so it is read like a success.
        {
          validateStatus: (code) => (code >= 200 && code < 300) || code === 409,
        },
      ),
    );

    if (status === 409) {
      const twin = data ? data.publication : undefined;
      if (twin) return { outcome: "identical", twin };

      throw (data && data.error) || "conflict";
    }

    notify({
      message: "notify.publicationRestored",
      detail: "notify.publicationRestoredDetail",
      level: "success",
    });
    return { outcome: "restored" };
  } catch (error) {
    notify({
      message: isConflict(error)
        ? "notify.restoreOutpaced"
        : "notify.restoreFailed",
      detail: isConflict(error)
        ? "notify.restoreOutpacedDetail"
        : "notify.nothingChanged",
      level: "warning",
    });
    return { outcome: "failed" };
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
      message: "notify.merged",
      detail: "notify.mergedDetail",
      values: { count: ids.length, title: winner.title },
      level: "success",
    });
    return true;
  } catch (error) {
    notify({
      message: isConflict(error)
        ? "notify.mergeOutpaced"
        : "notify.mergeFailed",
      detail: isConflict(error)
        ? "notify.mergeOutpacedDetail"
        : "notify.nothingChanged",
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
      message: "notify.reconsidered",
      detail: "notify.reconsideredDetail",
      level: "success",
    });
    return true;
  } catch {
    notify({
      message: "notify.reconsiderFailed",
      detail: "notify.nothingChanged",
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
      message: "notify.distinguished",
      detail: "notify.distinguishedDetail",
      level: "success",
    });
    return true;
  } catch {
    notify({
      message: "notify.distinguishFailed",
      detail: "notify.nothingChanged",
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
  const publication = store.get(publicationFamily(id));
  const fingerprint = contentKey(publication);

  // Same dedup as `validate`: this runs on every blur (and on every change for
  // array fields), so a field the user only tabbed through costs no round-trip.
  if (fingerprint === store.get(lastValidatedFamily(id))) return;
  store.set(lastValidatedFamily(id), fingerprint);

  return run(async (http) => {
    const { data } = await http.post<ValidationResult>(
      `publications/${id}/validate`,
      publication,
    );
    setErrors(store, [{ id, publication, errors: data.errors }]);
  });
}

/**
 * Validates the rows `ids` server-side and stores the results with `setErrors`.
 *
 * A row is left out when its content was already validated: when this client
 * has sent that content (`lastValidatedFamily`), or when the store's document
 * holds a result for it. With `force`, every row is sent. A row the store does
 * not hold is left out.
 */
async function validate(
  store: Store,
  ids: PublicationId[],
  { force = false }: { force?: boolean } = {},
): Promise<void> {
  return run(async (http) => {
    const { doc } = documentOf(store);
    const pending = ids
      .map((id) => ({
        id,
        publication: store.get(publicationFamily(id)),
      }))
      .filter(({ publication }) => publication !== undefined)
      .map((entry) => ({ ...entry, content: contentKey(entry.publication) }))
      .filter(
        ({ id, content }) =>
          force ||
          (content !== store.get(lastValidatedFamily(id)) &&
            content !== Doc.validationOf(doc, id)?.content),
      )
      .map(({ id, publication, content }) => {
        store.set(lastValidatedFamily(id), content);
        return { id, publication };
      });

    if (pending.length > 0) {
      const { data } = await http.post<ValidationResult[]>(
        "publications/validate",
        pending.map(({ publication }) => publication),
      );
      // Map results back to the rows we actually sent (the filtered set),
      // not the original id list. Each result is stored for the content
      // that was sent, not the server's copy of it.
      setErrors(
        store,
        data.map((entry, i) => ({
          id: pending[i].id,
          publication: pending[i].publication,
          errors: entry.errors,
        })),
      );
    }
  });
}

/**
 * Sends the rows `ids` to the resemblances endpoint and stores what each row
 * resembles with `setResemblances`.
 *
 * The server does not know the rows' ids, so the response names each row by its
 * position in the request. The server stores nothing, and this function does
 * not change or remove any row.
 */
async function resemblances(store: Store, ids: PublicationId[]): Promise<void> {
  return run(async (http) => {
    const subject = store.get(resemblanceSubjectAtom);
    const asked = ids.map((id) => store.get(rowSubjectFamily(id)));
    const rows = ids.map((id) =>
      pick(store.get(publicationFamily(id)), RESEMBLANCE_ATTRIBUTES),
    );

    const { data } = await http.post<{ entries: ResemblanceEntry[] }>(
      "publications/duplicates/resemblances",
      rows,
    );

    // If a row's subject (see `rowSubjectFamily`) or the set of rows changed
    // while the request was in flight, the response describes old values and
    // is dropped. The change has already scheduled a new check
    // (see `watchChecks`).
    const moved =
      store.get(resemblanceSubjectAtom) !== subject ||
      ids.some((id, index) => store.get(rowSubjectFamily(id)) !== asked[index]);

    if (moved) return;

    setResemblances(
      store,
      ids,
      new Map(
        data.entries.map((entry) => [
          ids[entry.position],
          {
            stored: entry.stored,
            // Converts the other rows' positions back to row ids.
            others: entry.others.map((position) => ids[position]),
            repeats: entry.repeats === null ? null : ids[entry.repeats],
          },
        ]),
      ),
    );
  });
}

/**
 * Adds the rows of an uploaded CSV, validated by the server, after the rows
 * already in the working set (see `append`). A failed upload leaves the rows as
 * they were.
 */
async function upload(store: Store, payload: FormData): Promise<void> {
  return run(async (http) => {
    const { data } = await http.post<ValidationResult[]>(
      "publications/validate",
      payload,
    );
    append(
      store,
      data.map((entry) => ({ ...entry, id: createId() })),
    );
  });
}

/**
 * The look-alike check, held in an object and read when a check runs, so it can
 * be replaced with one that does not reach the network, as `Author.REMOTE` is.
 */
const REMOTE = { resemblances };

export {
  REMOTE,
  bulk,
  deletePublication,
  distinguish,
  loadDetails,
  merge,
  reconsider,
  resemblances,
  restore,
  search,
  undo,
  update,
  upload,
  validate,
  validateUpdate,
};
export type { Restoration };
