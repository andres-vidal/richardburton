import { request } from "app";
import { AxiosError, AxiosInstance } from "axios";
import { notify } from "components/Notifications";
import { RESET } from "jotai/utils";
import { TOTAL_COUNT_HEADER } from "modules/api";
import hash from "object-hash";
import { useCallback } from "react";
import useDebounce from "utils/useDebounce";

import type { Publication } from "./model";
import {
  PublicationError,
  PublicationId,
  ValidationResult,
  describeError,
} from "./model";
import {
  createId,
  errorFamily,
  isIndexLoadingAtom,
  isValidatingAtom,
  keywordsAtom,
  lastValidatedFamily,
  overrideFamily,
  publicationFamily,
  publicationIdsAtom,
  resetAll,
  setAll,
  setErrors,
  store,
  totalIndexCountAtom,
  visibleIdsAtom,
  visiblePublicationFamily,
} from "./store";

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

type IndexResult = { entries: Publication[]; keywords?: string[] };

type IndexOptions = { search?: string; unreferenced?: boolean };

/**
 * Load the publication index into the store and return its ids in order. Filter
 * by `search`, or to only the publications missing references (`unreferenced`) —
 * the queue the references backfill wizard steps through.
 */
async function index({ search, unreferenced }: IndexOptions = {}): Promise<
  PublicationId[]
> {
  return run(async (http) => {
    const query = search
      ? `?search=${search}`
      : unreferenced
        ? "?unreferenced"
        : "";

    // Leave the current rows on screen while the new results load — the skeleton
    // is only for the first load (publicationIdsAtom starts undefined). The
    // search bar shows a subtle loading bar instead (isIndexLoadingAtom).
    try {
      const { data, headers } = await http.get<IndexResult>(
        `publications${query}`,
      );
      const { entries, keywords } = data;

      // Read raw: the client no longer camelCases response headers (see modules/http).
      if (headers[TOTAL_COUNT_HEADER]) {
        store.set(totalIndexCountAtom, parseInt(headers[TOTAL_COUNT_HEADER]));
      }
      store.set(keywordsAtom, keywords ?? []);

      const ids = entries.map((entry) => entry.id!);
      store.set(publicationIdsAtom, ids);
      entries.forEach((entry, i) =>
        store.set(publicationFamily(ids[i]), entry),
      );

      return ids;
    } finally {
      store.set(isIndexLoadingAtom, false);
    }
  });
}

/** Submit the current (visible) working set. */
async function bulk(): Promise<Publication[]> {
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
async function update(id: PublicationId): Promise<boolean> {
  const publication = store.get(visiblePublicationFamily(id));

  try {
    const { data } = await request((http) =>
      http.put<Publication>(`publications/${id}`, publication),
    );

    // Replace the row with the server's canonical value and clear the edit.
    store.set(publicationFamily(id), data);
    store.set(overrideFamily(id), RESET);
    store.set(errorFamily(id), RESET);
    notify({ message: "Publication updated.", level: "success" });
    return true;
  } catch (error) {
    const { response } = error as AxiosError<{ errors: PublicationError }>;

    if (response?.status === 409) {
      notify({ message: describeError("conflict"), level: "warning" });
    } else if (response?.status === 400) {
      store.set(errorFamily(id), response.data?.errors ?? null);
    } else {
      notify({
        message: "The publication could not be updated.",
        level: "warning",
      });
    }

    return false;
  }
}

/**
 * Live-validate a single publication's pending edits, excluding it from the
 * conflict check so an in-place edit doesn't collide with itself.
 */
async function validateUpdate(id: PublicationId): Promise<void> {
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
    setErrors([{ ...data, id }]);
  });
}

/** Validate the given rows server-side, but only those whose value changed. */
async function validate(ids: PublicationId[]): Promise<void> {
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
        setErrors(data.map((entry, i) => ({ ...entry, id: pending[i].id })));
      }
    } finally {
      // Always clear the flag, even if the request throws.
      store.set(isValidatingAtom, false);
    }
  });
}

/** Replace the working set from an uploaded CSV (validated server-side). */
async function upload(payload: FormData): Promise<void> {
  return run(async (http) => {
    resetAll();
    try {
      const { data } = await http.post<ValidationResult[]>(
        "publications/validate",
        payload,
      );
      setAll(data.map((entry) => ({ ...entry, id: createId() })));
    } catch (error) {
      setAll([]);
      throw error;
    }
  });
}

/** Debounced index, for search-as-you-type. */
function usePublicationIndex() {
  const debounced = useDebounce(index, 350);
  // Flag loading immediately (before the debounce) so the search bar's loading
  // bar spans the whole keystroke-to-results window, not just the fetch.
  return useCallback(
    (args?: { search?: string }) => {
      store.set(isIndexLoadingAtom, true);
      return debounced(args);
    },
    [debounced],
  );
}

export {
  bulk,
  index,
  update,
  upload,
  usePublicationIndex,
  validate,
  validateUpdate,
};
