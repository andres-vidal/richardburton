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
  errorFamily,
  fieldErrorCodeFamily,
  fieldValueFamily,
  focusedRowIdAtom,
  hiddenAttributesAtom,
  invalidIdsAtom,
  isValidFamily,
  matchedAtom,
  isValidatingAtom,
  overriddenCountAtom,
  overriddenIdsAtom,
  overrideFamily,
  publicationOrNullFamily,
  publicationSourcesFamily,
  publicationExcerptsFamily,
  publicationFamily,
  storedFieldValueFamily,
  storedSourcesFamily,
  totalCountAtom,
  matchingCountAtom,
  totalIndexCountAtom,
  unsourcedCountAtom,
  resemblanceFamily,
  reviewingAtom,
  resemblingCountAtom,
  resemblingIdsAtom,
  validCountAtom,
  visibleAttributesAtom,
  visibleCountAtom,
  visibleIdsAtom,
  visiblePublicationFamily,
} from "./store";

// Reads are thin `useAtomValue` wrappers; writes are the plain action functions
// exported from ./store (they operate on the module store directly, so they
// don't need to be hooks). Components read with these and call actions inline.

const NULL_PUBLICATION = atom<Publication | null>(null);

function useVisiblePublicationIds() {
  return useAtomValue(visibleIdsAtom);
}

function useOverriddenPublicationIds() {
  return useAtomValue(overriddenIdsAtom);
}

/** A publication with pending edits merged in (base ⊕ overrides). */
function useVisiblePublication(id: PublicationId) {
  return useAtomValue(visiblePublicationFamily(id));
}

/** The stored (unedited) publication, or null — accepts an undefined id. */
function usePublication(id: PublicationId | undefined) {
  return useAtomValue(
    id !== undefined ? publicationOrNullFamily(id) : NULL_PUBLICATION,
  );
}

/** A single cell's edited value — its own subscription. */
function usePublicationField<K extends PublicationKey>(
  id: PublicationId,
  key: K,
) {
  return useAtomValue(fieldValueFamily({ id, key })) as Publication[K];
}

/** A single cell's stored value, ignoring pending edits — its own subscription. */
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
 * A single cell as the index marked it, or as stored where the search did not
 * match. Reads the *stored* publication, so a pending edit does not leak into
 * the read-only table.
 */
function usePublicationMarkedField(id: PublicationId, key: PublicationKey) {
  const publication = useAtomValue(publicationFamily(id));

  return usePublicationMarking().value(publication, key);
}

function usePublicationExcerpts(id: PublicationId) {
  return useAtomValue(publicationExcerptsFamily(id));
}

function usePublicationSources(id: PublicationId) {
  return useAtomValue(publicationSourcesFamily(id));
}

/** The persisted sources only — drafts don't show until saved. */
function useStoredPublicationSources(id: PublicationId) {
  return useAtomValue(storedSourcesFamily(id));
}

/** The rows something is wrong with, in the order they are shown. */
function useInvalidPublicationIds() {
  return useAtomValue(invalidIdsAtom);
}

function usePublicationError(id: PublicationId) {
  return useAtomValue(errorFamily(id));
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

function usePublicationOverride(id: PublicationId) {
  return useAtomValue(overrideFamily(id));
}

function useIsPublicationValid(id: PublicationId) {
  return useAtomValue(isValidFamily(id));
}

function useIsPublicationFocused(id: PublicationId) {
  return id === useAtomValue(focusedRowIdAtom);
}

function useVisiblePublicationCount() {
  return useAtomValue(visibleCountAtom);
}

function useValidPublicationCount() {
  return useAtomValue(validCountAtom);
}

/** What this row resembles, or null where it resembles nothing. */
function usePublicationResemblance(id: PublicationId) {
  return useAtomValue(resemblanceFamily(id));
}

/** Which look-alike the review is open on, or null while it is closed. */
function useReviewing() {
  return useAtomValue(reviewingAtom);
}

/** The rows raising a look-alike nobody has accepted yet. */
function useResemblingPublicationIds() {
  return useAtomValue(resemblingIdsAtom);
}

function useResemblingPublicationCount() {
  return useAtomValue(resemblingCountAtom);
}

function useDiscardedPublicationCount() {
  return useAtomValue(discardedCountAtom);
}

function useOverriddenPublicationCount() {
  return useAtomValue(overriddenCountAtom);
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
  useOverriddenPublicationCount,
  useOverriddenPublicationIds,
  usePublication,
  usePublicationError,
  usePublicationErrorDescription,
  usePublicationField,
  usePublicationFieldError,
  useMatchingCount,
  usePublicationIndexCount,
  usePublicationOverride,
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
  useResemblingPublicationIds,
  useValidPublicationCount,
  useVisibleAttributes,
  useVisiblePublication,
  useVisiblePublicationCount,
  useVisiblePublicationIds,
};
