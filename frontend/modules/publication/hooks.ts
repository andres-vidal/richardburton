import type { SetStateAction } from "jotai";
import { atom, useAtom, useAtomValue } from "jotai";
import { useLocale, useTranslations } from "next-intl";
import { useCountryNaming } from "modules/country-names";
import { Publication, PublicationId, PublicationKey, marking } from "./model";
import type { Marking } from "./model";
import {
  areRowIdsVisibleAtom,
  attributeVisibleFamily,
  discardedCountAtom,
  errorCodeFamily,
  fieldErrorCodeFamily,
  fieldValueFamily,
  focusedRowIdAtom,
  hiddenAttributesAtom,
  invalidIdsAtom,
  isValidFamily,
  matchedAtom,
  isValidatingAtom,
  publicationSourcesFamily,
  publicationExcerptsFamily,
  publicationFamily,
  savedFamily,
  storedFieldValueFamily,
  storedSourcesFamily,
  totalCountAtom,
  matchingCountAtom,
  totalIndexCountAtom,
  unsourcedCountAtom,
  resemblanceFamily,
  reviewingAtom,
  resemblingCountAtom,
  rowErrorFamily,
  rowNumberFamily,
  validCountAtom,
  visibleAttributesAtom,
  visibleCountAtom,
  visibleIdsAtom,
} from "./store";

// Reads are thin `useAtomValue` wrappers; writes are the plain action functions
// exported from ./store (they operate on the module store directly, so they
// don't need to be hooks). Components read with these and call actions inline.

const NO_PUBLICATION = atom<Publication | undefined>(undefined);

function useVisiblePublicationIds() {
  return useAtomValue(visibleIdsAtom);
}

/** A row as it is being edited, including unsaved edits. */
function useVisiblePublication(id: PublicationId) {
  return useAtomValue(publicationFamily(id));
}

/**
 * The saved publication, or null when there is none. Accepts an undefined id.
 */
function usePublication(id: PublicationId | undefined) {
  return (
    useAtomValue(id !== undefined ? savedFamily(id) : NO_PUBLICATION) ?? null
  );
}

/** A single cell's edited value — its own subscription. */
function usePublicationField<K extends PublicationKey>(
  id: PublicationId,
  key: K,
) {
  return useAtomValue(fieldValueFamily({ id, key })) as Publication[K];
}

/** A single cell's saved value, ignoring unsaved edits. Each cell has its own
 * subscription. */
function usePublicationStoredField<K extends PublicationKey>(
  id: PublicationId,
  key: K,
) {
  return useAtomValue(storedFieldValueFamily({ id, key })) as Publication[K];
}

/**
 * How a publication reads on this page: in its language, naming countries from
 * the catalogue. Taken once and asked about any field.
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

function usePublicationExcerpts(id: PublicationId) {
  return useAtomValue(publicationExcerptsFamily(id));
}

function usePublicationSources(id: PublicationId) {
  return useAtomValue(publicationSourcesFamily(id));
}

/** The saved sources only, without unsaved edits. */
function useStoredPublicationSources(id: PublicationId) {
  return useAtomValue(storedSourcesFamily(id));
}

/** The rows something is wrong with, in the order they are shown. */
function useInvalidPublicationIds() {
  return useAtomValue(invalidIdsAtom);
}

function usePublicationError(id: PublicationId) {
  return useAtomValue(rowErrorFamily(id));
}

/** An error code as a sentence, or the code itself where there is none for it. */
function useErrorSentence(code: string): string {
  const t = useTranslations("publicationError");
  return code && t.has(code) ? t(code) : code;
}

/**
 * What is wrong with a publication, in words. A code with no sentence for it is
 * shown as the code, so an error newer than this catalogue still reaches the
 * reader.
 */
function usePublicationErrorDescription(id: PublicationId) {
  return useErrorSentence(useAtomValue(errorCodeFamily(id)));
}

function usePublicationFieldError(id: PublicationId, key: PublicationKey) {
  return useErrorSentence(useAtomValue(fieldErrorCodeFamily({ id, key })));
}

function useIsPublicationValid(id: PublicationId) {
  return useAtomValue(isValidFamily(id));
}

function useIsPublicationFocused(id: PublicationId) {
  return id === useAtomValue(focusedRowIdAtom);
}

/**
 * The row's position among the visible (not discarded) rows, counting from
 * one, or 0 when it is not visible.
 */
function usePublicationRowNumber(id: PublicationId) {
  return useAtomValue(rowNumberFamily(id));
}

function useVisiblePublicationCount() {
  return useAtomValue(visibleCountAtom);
}

function useValidPublicationCount() {
  return useAtomValue(validCountAtom);
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

/** Returns how many visible rows resemble something. */
function useResemblingPublicationCount() {
  return useAtomValue(resemblingCountAtom);
}

function useDiscardedPublicationCount() {
  return useAtomValue(discardedCountAtom);
}

function useTotalPublicationCount() {
  return useAtomValue(totalCountAtom);
}

/** How many loaded publications still lack sources (live). */
function useUnsourcedPublicationCount() {
  return useAtomValue(unsourcedCountAtom);
}

function usePublicationIndexCount() {
  return useAtomValue(totalIndexCountAtom);
}

/** How many publications answered the current query, across every page. */
function useMatchingCount() {
  return useAtomValue(matchingCountAtom);
}

function useMatched() {
  return useAtomValue(matchedAtom);
}

function useIsValidating() {
  return useAtomValue(isValidatingAtom);
}

function useVisibleAttributes() {
  return useAtomValue(visibleAttributesAtom);
}

function useHiddenAttributes() {
  return useAtomValue(hiddenAttributesAtom);
}

function useIsAttributeVisible(key: PublicationKey) {
  return useAtomValue(attributeVisibleFamily(key));
}

function useAreRowIdsVisible(): [
  boolean,
  (update: SetStateAction<boolean>) => void,
] {
  return useAtom(areRowIdsVisibleAtom);
}

export {
  useAreRowIdsVisible,
  useDiscardedPublicationCount,
  useHiddenAttributes,
  useIsAttributeVisible,
  useInvalidPublicationIds,
  useIsPublicationFocused,
  useIsPublicationValid,
  useMatched,
  useIsValidating,
  usePublication,
  usePublicationError,
  usePublicationErrorDescription,
  usePublicationField,
  usePublicationFieldError,
  useMatchingCount,
  usePublicationIndexCount,
  usePublicationSources,
  usePublicationExcerpts,
  usePublicationMarkedField,
  usePublicationMarking,
  usePublicationStoredField,
  useStoredPublicationSources,
  useTotalPublicationCount,
  useUnsourcedPublicationCount,
  usePublicationResemblance,
  useResemblingPublicationCount,
  useReviewing,
  usePublicationRowNumber,
  useValidPublicationCount,
  useVisibleAttributes,
  useVisiblePublication,
  useVisiblePublicationCount,
  useVisiblePublicationIds,
};
