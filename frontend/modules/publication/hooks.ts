import type { SetStateAction } from "jotai";
import { atom, useAtom, useAtomValue } from "jotai";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { useCountryNaming } from "modules/country-names";
import { Publication, PublicationId, PublicationKey, marking } from "./model";
import type { Marking } from "./model";
import {
  areRowIdsVisibleAtom,
  attributeVisibleFamily,
  batchNamesAtom,
  errorCodeFamily,
  fieldErrorCodeFamily,
  fieldValueFamily,
  focusedRowIdAtom,
  hiddenAttributesAtom,
  invalidIdsAtom,
  isValidFamily,
  publicationSourcesFamily,
  publicationCommentsFamily,
  commentsErrorCodeFamily,
  publicationExcerptsFamily,
  publicationCountAtom,
  publicationFamily,
  publicationIdsAtom,
  savedFamily,
  storedSourcesFamily,
  matchingCountAtom,
  totalIndexCountAtom,
  unsourcedCountAtom,
  resemblanceFamily,
  reviewingAtom,
  resemblingCountAtom,
  rowErrorFamily,
  rowNumberFamily,
  uncheckedCountAtom,
  validCountAtom,
  visibleAttributesAtom,
} from "./store";

// The hooks that read the publication store of the nearest
// `PublicationStoreProvider`. Each one reads one atom of `./store`. Writes are
// the actions in `./store`, which take the store as their first argument.

/** An atom that always reads undefined, read when there is no row to read. */
const NO_PUBLICATION = atom<Publication | undefined>(undefined);

/** The ids of the rows in the list, in order. */
function usePublicationIds() {
  return useAtomValue(publicationIdsAtom);
}

/** A row as it is being edited, including unsaved edits. */
function useVisiblePublication(id: PublicationId) {
  return useAtomValue(publicationFamily(id));
}

/**
 * Several rows as they are being edited, in the order of `ids`. The rows
 * update as they are edited.
 *
 * The hook builds an atom for `ids`, so pass the same array for as long as the
 * ids are the same.
 */
function useVisiblePublications(ids: PublicationId[]): Publication[] {
  const rows = useMemo(
    () => atom((get) => ids.map((id) => get(publicationFamily(id)))),
    [ids],
  );

  return useAtomValue(rows);
}

/**
 * The saved publication, or null when there is none. Accepts an undefined id.
 */
function usePublication(id: PublicationId | undefined) {
  return (
    useAtomValue(id !== undefined ? savedFamily(id) : NO_PUBLICATION) ?? null
  );
}

/** A single cell's value, including unsaved edits. Each cell has its own atom. */
function usePublicationField<K extends PublicationKey>(
  id: PublicationId,
  key: K,
) {
  return useAtomValue(fieldValueFamily({ id, key })) as Publication[K];
}

/**
 * Returns how a publication reads on this page: in the page's language, with
 * countries named from the `countryNames` catalogue. See `marking`.
 */
function usePublicationMarking(): Marking {
  const locale = useLocale();
  const country = useCountryNaming();

  return marking(locale, country);
}

/**
 * A single cell as the index marked it, or as saved where the search did not
 * match. It reads the saved publication, so an unsaved edit does not show in
 * the read-only table. A row with no saved copy returns an empty string.
 */
function usePublicationMarkedField(id: PublicationId, key: PublicationKey) {
  const publication = useAtomValue(savedFamily(id));
  const marking = usePublicationMarking();

  return publication ? marking.value(publication, key) : "";
}

/** The matching text of each of a saved publication's fields in a search. */
function usePublicationExcerpts(id: PublicationId) {
  return useAtomValue(publicationExcerptsFamily(id));
}

/** A row's sources, including unsaved edits. */
function usePublicationSources(id: PublicationId) {
  return useAtomValue(publicationSourcesFamily(id));
}

/** A row's comments in Markdown, including unsaved edits, or null for none. */
function usePublicationComments(id: PublicationId) {
  return useAtomValue(publicationCommentsFamily(id));
}

/** Returns what is wrong with a row's comments, in words. */
function usePublicationCommentsError(id: PublicationId) {
  return useErrorSentence(useAtomValue(commentsErrorCodeFamily(id)));
}

/** The saved sources only, without unsaved edits. */
function useStoredPublicationSources(id: PublicationId) {
  return useAtomValue(storedSourcesFamily(id));
}

/** The rows something is wrong with, in the order they are shown. */
function useInvalidPublicationIds() {
  return useAtomValue(invalidIdsAtom);
}

/** What is wrong with a row, or null when nothing is (see `rowErrorFamily`). */
function usePublicationError(id: PublicationId) {
  return useAtomValue(rowErrorFamily(id));
}

/** Returns an error code's sentence, or the code itself when it has none. */
function useErrorSentence(code: string): string {
  const t = useTranslations("publicationError");
  return code && t.has(code) ? t(code) : code;
}

/**
 * Returns what is wrong with a row as a whole, in words. A code with no
 * sentence in the `publicationError` messages is returned as the code.
 */
function usePublicationErrorDescription(id: PublicationId) {
  return useErrorSentence(useAtomValue(errorCodeFamily(id)));
}

/** Returns what is wrong with one field of a row, in words. */
function usePublicationFieldError(id: PublicationId, key: PublicationKey) {
  return useErrorSentence(useAtomValue(fieldErrorCodeFamily({ id, key })));
}

/** Whether nothing is wrong with a row. */
function useIsPublicationValid(id: PublicationId) {
  return useAtomValue(isValidFamily(id));
}

/** Whether a row holds the focus. */
function useIsPublicationFocused(id: PublicationId) {
  return id === useAtomValue(focusedRowIdAtom);
}

/**
 * The row's position in the list, counting from one, or 0 when it is not in
 * the list.
 */
function usePublicationRowNumber(id: PublicationId) {
  return useAtomValue(rowNumberFamily(id));
}

/** The number of rows in the list. */
function usePublicationCount() {
  return useAtomValue(publicationCountAtom);
}

/** The number of rows nothing is wrong with. */
function useValidPublicationCount() {
  return useAtomValue(validCountAtom);
}

/** How many rows have no validation result for their current content. */
function useUncheckedPublicationCount() {
  return useAtomValue(uncheckedCountAtom);
}

/**
 * Returns what this row resembles, or null when it resembles nothing or its
 * last result no longer matches the row.
 */
function usePublicationResemblance(id: PublicationId) {
  return useAtomValue(resemblanceFamily(id));
}

/**
 * Returns `{ startAt }` while the resemblance review is open, where `startAt` is
 * the row it opened on, or undefined when it opened at the start of the queue.
 * Returns null when the review is closed.
 */
function useReviewing() {
  return useAtomValue(reviewingAtom);
}

/** Returns how many rows resemble something. */
function useResemblingPublicationCount() {
  return useAtomValue(resemblingCountAtom);
}

/** How many rows in the list have no saved sources. */
function useUnsourcedPublicationCount() {
  return useAtomValue(unsourcedCountAtom);
}

/** How many publications the database holds, or null before the index says. */
function usePublicationIndexCount() {
  return useAtomValue(totalIndexCountAtom);
}

/** How many publications answered the current query, across every page. */
function useMatchingCount() {
  return useAtomValue(matchingCountAtom);
}

/** The attributes whose columns are shown. */
function useVisibleAttributes() {
  return useAtomValue(visibleAttributesAtom);
}

/** The attributes whose columns are hidden. */
function useHiddenAttributes() {
  return useAtomValue(hiddenAttributesAtom);
}

/** Whether an attribute's column is shown. */
function useIsAttributeVisible(key: PublicationKey) {
  return useAtomValue(attributeVisibleFamily(key));
}

/** Whether rows show their numbers, and a function that changes it. */
function useAreRowIdsVisible(): [
  boolean,
  (update: SetStateAction<boolean>) => void,
] {
  return useAtom(areRowIdsVisibleAtom);
}

/** The names the batch would enter, by kind. */
const useBatchNames = () => useAtomValue(batchNamesAtom);

export {
  usePublicationCount,
  usePublicationIds,
  useAreRowIdsVisible,
  useBatchNames,
  useHiddenAttributes,
  useIsAttributeVisible,
  useInvalidPublicationIds,
  useIsPublicationFocused,
  useIsPublicationValid,
  usePublication,
  usePublicationError,
  usePublicationErrorDescription,
  usePublicationField,
  usePublicationFieldError,
  useMatchingCount,
  usePublicationIndexCount,
  usePublicationSources,
  usePublicationComments,
  usePublicationCommentsError,
  usePublicationExcerpts,
  usePublicationMarkedField,
  usePublicationMarking,
  useStoredPublicationSources,
  useUnsourcedPublicationCount,
  usePublicationResemblance,
  useResemblingPublicationCount,
  useReviewing,
  usePublicationRowNumber,
  useUncheckedPublicationCount,
  useValidPublicationCount,
  useVisibleAttributes,
  useVisiblePublication,
  useVisiblePublications,
};
