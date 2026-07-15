import { request } from "app";
import { AxiosInstance } from "axios";
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
  isIndexLoadingAtom,
  isValidatingAtom,
  keywordsAtom,
  lastValidatedFamily,
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

/** Load the publication index (optionally filtered by `search`). */
async function index({ search }: { search?: string } = {}): Promise<void> {
  return run(async (http) => {
    const url = search ? `publications?search=${search}` : "publications";

    // Leave the current rows on screen while the new results load — the skeleton
    // is only for the first load (publicationIdsAtom starts undefined). The
    // search bar shows a subtle loading bar instead (isIndexLoadingAtom).
    try {
      const { data, headers } = await http.get<IndexResult>(url);
      const { entries, keywords } = data;

      // Read raw: the client no longer camelCases response headers (see modules/http).
      if (headers[TOTAL_COUNT_HEADER]) {
        store.set(totalIndexCountAtom, parseInt(headers[TOTAL_COUNT_HEADER]));
      }
      store.set(keywordsAtom, keywords);

      const ids = entries.map((entry) => entry.id!);
      store.set(publicationIdsAtom, ids);
      entries.forEach((entry, i) =>
        store.set(publicationFamily(ids[i]), entry),
      );
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
    const { data } = await http.post<ValidationResult[]>(
      "publications/validate",
      payload,
    );
    setAll(data.map((entry) => ({ ...entry, id: createId() })));
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

export { bulk, index, upload, usePublicationIndex, validate };
