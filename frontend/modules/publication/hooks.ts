import { atom, useAtom, useAtomValue } from "jotai";
import type { SetStateAction } from "jotai";
import { Publication, PublicationId, PublicationKey } from "./model";
import {
  areRowIdsVisibleAtom,
  attributeVisibleFamily,
  deletedCountAtom,
  errorDescriptionFamily,
  errorFamily,
  fieldErrorDescriptionFamily,
  fieldValueFamily,
  focusedRowIdAtom,
  hiddenAttributesAtom,
  isIndexLoadingAtom,
  isValidFamily,
  isValidatingAtom,
  keywordsAtom,
  overrideFamily,
  overriddenCountAtom,
  overriddenIdsAtom,
  publicationOrNullFamily,
  totalCountAtom,
  totalIndexCountAtom,
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

function useDeletedPublicationCount() {
  return useAtomValue(deletedCountAtom);
}

function useOverriddenPublicationCount() {
  return useAtomValue(overriddenCountAtom);
}

function useTotalPublicationCount() {
  return useAtomValue(totalCountAtom);
}

function usePublicationIndexCount() {
  return useAtomValue(totalIndexCountAtom);
}

function useIsValidating() {
  return useAtomValue(isValidatingAtom);
}

function useIsIndexLoading() {
  return useAtomValue(isIndexLoadingAtom);
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
  useDeletedPublicationCount,
  useHiddenAttributes,
  useIsAttributeVisible,
  useIsIndexLoading,
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
  useTotalPublicationCount,
  useValidPublicationCount,
  useVisibleAttributes,
  useVisiblePublication,
  useVisiblePublicationCount,
  useVisiblePublicationIds,
};
