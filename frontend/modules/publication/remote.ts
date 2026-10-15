import { pick } from "lodash";
import { request } from "app";
import { AxiosInstance } from "axios";
import { notify } from "components/Notifications";
import { RESET } from "jotai/utils";
import { attempt } from "modules/attempt";
import { ApiError } from "modules/http";
import type { Store } from "modules/store";

import type {
  Publication,
  PublicationError,
  PublicationHistoryEntry,
  PublicationId,
  Resemblance,
  ValidationResult,
} from "./model";
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
 * One entry of the resemblances response. `position`, `others` and `repeats`
 * are indexes into the list of rows the request sent.
 */
type ResemblanceEntry = Omit<Resemblance, "others" | "repeats"> & {
  position: number;
  others: number[];
  repeats: number | null;
};

/** Whether `error` is a refusal from the server with the code "conflict". */
const isConflict = (error: unknown): error is ApiError =>
  error instanceof ApiError && error.code === "conflict";

/**
 * Runs a server call. When it fails, `run` notifies the failure and rethrows
 * the error, so a caller can react to it, as by resetting a file input.
 *
 * The notice names the copy for the error's code under `publicationError`, and
 * a failure without a code is notified with its message.
 */
async function run<T>(op: (http: AxiosInstance) => Promise<T>): Promise<T> {
  try {
    return await request(op);
  } catch (error) {
    const code = error instanceof ApiError ? error.code : undefined;

    notify({
      message: code
        ? `publicationError.${code}`
        : error instanceof Error
          ? error.message
          : String(error),
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
 * Saves the edits to one stored publication, and returns whether the save
 * succeeded. On a conflict or a validation error, the row keeps its edits so
 * they can be fixed.
 *
 * When the server refuses the edit with field errors, `update` stores them as
 * the row's errors (`errorFamily`) and notifies nothing. Any other failure is
 * notified.
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
    if (isConflict(error)) {
      notify({
        message: "publicationError.conflict",
        detail: "notify.conflictDetail",
        level: "warning",
      });
    } else if (
      error instanceof ApiError &&
      error.status === 400 &&
      error.errors
    ) {
      store.set(errorFamily(id), error.errors as PublicationError);
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
 * Deletes a publication, removes it from the store, and returns whether the
 * delete succeeded. The server keeps the record as deleted, so it can be
 * restored, and records the delete in the publication's history.
 */
function deletePublication(
  store: Store,
  { id, title }: { id: PublicationId; title: string },
): Promise<boolean> {
  return attempt(
    async () => {
      await request((http) => http.delete(`publications/${id}`));

      removePublication(store, id);
      notify({
        message: "notify.publicationDeleted",
        detail: "notify.publicationDeletedDetail",
        values: { title },
        level: "success",
      });
    },
    {
      message: "notify.deleteFailed",
      detail: "notify.deleteFailedDetail",
      values: { title },
      level: "warning",
    },
  );
}

/**
 * Undoes the change that the history entry `version` of publication `id`
 * records, and returns whether the undo succeeded.
 *
 * The request names the entry and nothing else. The server decides which
 * change reverses it, and records that change as a new entry, which can be
 * undone in turn.
 */
function undo(
  id: PublicationId,
  version: PublicationHistoryEntry["version"],
): Promise<boolean> {
  return attempt(
    async () => {
      await request((http) =>
        http.post(`publications/${id}/history/${version}/undo`),
      );

      notify({ message: "notify.changeUndone", level: "success" });
    },
    (error) => ({
      message: isConflict(error) ? "notify.undoOutpaced" : "notify.undoFailed",
      detail: isConflict(error)
        ? "notify.undoOutpacedDetail"
        : "notify.nothingChanged",
      level: "warning",
    }),
  );
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
 * The server refuses a restore with a conflict when another publication that
 * is not deleted has the same identity, and names that publication in the
 * response. The result is then `identical`.
 *
 * A success and a failure are notified here. An `identical` outcome is not,
 * since the caller offers to restore the publication with changes.
 */
async function restore(
  id: PublicationId,
  changes?: Publication,
): Promise<Restoration> {
  try {
    await request((http) => http.post(`publications/${id}/restore`, changes));

    notify({
      message: "notify.publicationRestored",
      detail: "notify.publicationRestoredDetail",
      level: "success",
    });
    return { outcome: "restored" };
  } catch (error) {
    const twin = isConflict(error)
      ? (error.body as { publication?: Publication }).publication
      : undefined;

    if (twin) return { outcome: "identical", twin };

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
 * Returns the publications a search for `term` finds, or an empty list when
 * the search fails. A failure is not notified.
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
 * Merges `losers` into `winner`, removes the losers from the store, and
 * returns whether the merge succeeded. The winner keeps its identity and gains
 * what the losers hold, and the losers are recorded as merged. The server
 * refuses the merge with a conflict when the merged record would be one that
 * already exists.
 */
function merge(
  store: Store,
  { winner, losers }: { winner: Publication; losers: Publication[] },
): Promise<boolean> {
  const ids = losers.map((loser) => loser.id!);

  return attempt(
    async () => {
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
    },
    (error) => ({
      message: isConflict(error)
        ? "notify.mergeOutpaced"
        : "notify.mergeFailed",
      detail: isConflict(error)
        ? "notify.mergeOutpacedDetail"
        : "notify.nothingChanged",
      level: "warning",
    }),
  );
}

/**
 * Withdraws the decision that the publications `ids` are different records,
 * so the duplicate review offers them again. Returns whether it succeeded.
 */
function reconsider(ids: PublicationId[]): Promise<boolean> {
  return attempt(
    async () => {
      await request((http) =>
        http.post("publications/duplicates/reconsider", { publications: ids }),
      );

      notify({
        message: "notify.reconsidered",
        detail: "notify.reconsideredDetail",
        level: "success",
      });
    },
    {
      message: "notify.reconsiderFailed",
      detail: "notify.nothingChanged",
      level: "warning",
    },
  );
}

/**
 * Records that the publications `ids` are different records, so the duplicate
 * review stops offering them. Returns whether it succeeded.
 */
function distinguish(ids: PublicationId[]): Promise<boolean> {
  return attempt(
    async () => {
      await request((http) =>
        http.post("publications/duplicates/distinguish", { publications: ids }),
      );

      notify({
        message: "notify.distinguished",
        detail: "notify.distinguishedDetail",
        level: "success",
      });
    },
    {
      message: "notify.distinguishFailed",
      detail: "notify.nothingChanged",
      level: "warning",
    },
  );
}

/**
 * Validates the edits to one stored publication and stores the result with
 * `setErrors`. The server leaves the publication itself out of the conflict
 * check, so an edit does not conflict with the record it changes.
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
