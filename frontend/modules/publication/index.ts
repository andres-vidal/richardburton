// Public API for publication state. Model namespace + typed data on one side,
// Jotai-backed read hooks + imperative actions + remote calls on the other.

export { COUNTRIES, Publication } from "./model";
export type {
  PublicationEntry,
  PublicationError,
  PublicationId,
  PublicationKey,
  PublicationKeyType,
  ValidationResult,
} from "./model";

export * from "./hooks";

export {
  DRAFT_ID,
  addNew,
  duplicate,
  focusNextInvalid,
  overrideField,
  resetAll,
  resetAttributes,
  resetDeleted,
  resetOverridden,
  setAll,
  setAttributesVisible,
  setDeleted,
  setErrors,
  setFocusedRowId,
  setPublications,
} from "./store";

export { bulk, index, upload, usePublicationIndex, validate } from "./remote";
