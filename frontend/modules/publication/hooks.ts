import type { SetStateAction } from "jotai";
import { atom, useAtom, useAtomValue } from "jotai";
import { Publication, PublicationId, PublicationKey } from "./model";
import {
  areRowIdsVisibleAtom,
  attributeVisibleFamily,
  discardedCountAtom,
  errorDescriptionFamily,
  errorFamily,
  fieldErrorDescriptionFamily,
  fieldValueFamily,
  focusedRowIdAtom,
  hiddenAttributesAtom,
  isValidFamily,
  isValidatingAtom,
  keywordsAtom,
  overriddenCountAtom,
  overriddenIdsAtom,
  overrideFamily,
  publicationOrNullFamily,
  publicationReferencesFamily,
  publicationSourceMatchFamily,
  storedFieldValueFamily,
  storedReferencesFamily,
  totalCountAtom,
  totalIndexCountAtom,
  unreferencedCountAtom,
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

function usePublicationSourceMatch(id: PublicationId) {
  return useAtomValue(publicationSourceMatchFamily(id));
}

function usePublicationReferences(id: PublicationId) {
  return useAtomValue(publicationReferencesFamily(id));
}

/** The persisted references only — drafts don't show until saved. */
function useStoredPublicationReferences(id: PublicationId) {
  return useAtomValue(storedReferencesFamily(id));
}

function usePublicationError(id: PublicationId) {
  return useAtomValue(errorFamily(id));
}

function usePublicationErrorDescription(id: PublicationId) {
  return useAtomValue(errorDescriptionFamily(id));
}

function usePublicationFieldError(id: PublicationId, key: PublicationKey) {
  return useAtomValue(fieldErrorDescriptionFamily({ id, key }));
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

function useDiscardedPublicationCount() {
  return useAtomValue(discardedCountAtom);
}

function useOverriddenPublicationCount() {
  return useAtomValue(overriddenCountAtom);
}

function useTotalPublicationCount() {
  return useAtomValue(totalCountAtom);
}

/** How many loaded publications still lack references (live). */
function useUnreferencedPublicationCount() {
  return useAtomValue(unreferencedCountAtom);
}

function usePublicationIndexCount() {
  return useAtomValue(totalIndexCountAtom);
}

function useIsValidating() {
  return useAtomValue(isValidatingAtom);
}

function useKeywords() {
  return useAtomValue(keywordsAtom);
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
  useIsPublicationFocused,
  useIsPublicationValid,
  useIsValidating,
  useKeywords,
  useOverriddenPublicationCount,
  useOverriddenPublicationIds,
  usePublication,
  usePublicationError,
  usePublicationErrorDescription,
  usePublicationField,
  usePublicationFieldError,
  usePublicationIndexCount,
  usePublicationOverride,
  usePublicationReferences,
  usePublicationSourceMatch,
  usePublicationStoredField,
  useStoredPublicationReferences,
  useTotalPublicationCount,
  useUnreferencedPublicationCount,
  useValidPublicationCount,
  useVisibleAttributes,
  useVisiblePublication,
  useVisiblePublicationCount,
  useVisiblePublicationIds,
};
