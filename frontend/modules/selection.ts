import { atom, useAtomValue } from "jotai";
import { atomFamily } from "jotai-family";
import type { Store } from "modules/store";

/** The key of something that can be selected. */
type SelectableId = string | number;

/**
 * A click that asks to select `id`, of the kind `type`, with the modifier keys
 * held and the order of the rows it can extend a range along.
 */
type SelectionEvent = {
  id: SelectableId;
  type: string;
  metaKey?: boolean;
  shiftKey?: boolean;
  orderedIds?: SelectableId[];
};

/**
 * What is selected, the kind of thing it is, and the pivot: the row a
 * Shift-click extends a range from. Selecting a thing of another kind starts
 * the selection again.
 */
type SelectionState = {
  selection: Set<SelectableId>;
  type: string | null;
  pivot: SelectableId | null;
};

/** Returns a state with nothing selected. */
const empty = (): SelectionState => ({
  selection: new Set(),
  type: null,
  pivot: null,
});

/** The selection of the store. `select` replaces it on each click. */
const selectionStateAtom = atom<SelectionState>(empty());

// The derived atoms each read one part of the state, so a row re-renders only
// when whether it is selected changes.
const selectionAtom = atom((get) => get(selectionStateAtom).selection);
const selectionSizeAtom = atom((get) => get(selectionStateAtom).selection.size);
const isSelectionEmptyAtom = atom(
  (get) => get(selectionStateAtom).selection.size === 0,
);
const isSelectedFamily = atomFamily((id: SelectableId) =>
  atom((get) => get(selectionStateAtom).selection.has(id)),
);

// Returns the state after `event`. A plain click selects only the clicked row.
// A click with Cmd or Ctrl adds or removes the row. A click with Shift selects
// the rows from the pivot to the clicked row along `orderedIds`.
function reduce(state: SelectionState, event: SelectionEvent): SelectionState {
  const { id, type, metaKey, shiftKey, orderedIds } = event;

  // Selecting a different entity kind always restarts the selection.
  if (state.type !== type) {
    return { selection: new Set([id]), type, pivot: id };
  }

  // Without a row order, range selection is impossible, so modifiers just toggle.
  if (!orderedIds) {
    if (metaKey || shiftKey) {
      const selection = new Set(state.selection);
      if (selection.has(id)) selection.delete(id);
      else selection.add(id);
      return { selection, type, pivot: null };
    }
    return { selection: new Set([id]), type, pivot: null };
  }

  if (shiftKey) {
    if (state.pivot === null) {
      return { selection: new Set([id]), type, pivot: id };
    }
    // Clear the contiguous selected block anchored at the pivot, then select the
    // range from the pivot to the clicked row (the pivot itself stays put).
    const selection = new Set(state.selection);
    const pivotIndex = orderedIds.indexOf(state.pivot);

    let blockStart = pivotIndex;
    while (blockStart >= 0 && selection.has(orderedIds[blockStart]))
      blockStart--;
    let blockEnd = pivotIndex;
    while (blockEnd < orderedIds.length && selection.has(orderedIds[blockEnd]))
      blockEnd++;
    for (let i = blockStart + 1; i < blockEnd; i++)
      selection.delete(orderedIds[i]);

    const [from, to] = [orderedIds.indexOf(id), pivotIndex].sort(
      (a, b) => a - b,
    );
    for (let i = from; i <= to; i++) selection.add(orderedIds[i]);

    return { selection, type, pivot: state.pivot };
  }

  if (metaKey) {
    const selection = new Set(state.selection);
    if (!selection.has(id)) {
      selection.add(id);
      return { selection, type, pivot: id };
    }
    selection.delete(id);
    // Deselecting the pivot moves it to the next selected row (else the first).
    if (state.pivot !== id) {
      return { selection, type, pivot: state.pivot };
    }
    const pivotIndex = orderedIds.indexOf(id);
    const nextPivot =
      orderedIds.find(
        (rowId, index) => index > pivotIndex && selection.has(rowId),
      ) ??
      orderedIds.find((rowId) => selection.has(rowId)) ??
      null;
    return { selection, type, pivot: nextPivot };
  }

  // Plain click: select just the clicked row.
  return { selection: new Set([id]), type, pivot: id };
}

/**
 * The marker for a row's **selection handle**: a click on it, or on anything
 * inside it, asks for that row to be selected.
 *
 * It is separate from the attribute that allows text selection, and cells that
 * hold a field do not carry it, because a click in an input is for typing. The
 * row that selects and the listener that clears the selection both read this
 * selector, so they agree on what counts as a selection click.
 */
const SELECTION_HANDLE = '[data-selects-row="true"]';

/** Returns whether a click on `target` asks for a row to be selected. */
export function isSelectionGesture(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(SELECTION_HANDLE) !== null;
}

// --- Actions (each writes the store it is given) ----------------------------

/** Applies a click to the store's selection. */
export function select(store: Store, event: SelectionEvent): void {
  store.set(selectionStateAtom, reduce(store.get(selectionStateAtom), event));
}

/** Selects nothing. */
export function clearSelection(store: Store): void {
  store.set(selectionStateAtom, empty());
}

/** Returns the store's selection, without subscribing to it. */
export function getSelection(store: Store): Set<SelectableId> {
  return store.get(selectionAtom);
}

// --- Reads ------------------------------------------------------------------

/** Whether `id` is selected. */
export function useIsSelected(id: SelectableId): boolean {
  return useAtomValue(isSelectedFamily(id));
}

/** Whether nothing is selected. */
export function useIsSelectionEmpty(): boolean {
  return useAtomValue(isSelectionEmptyAtom);
}

/** How many things are selected. */
export function useSelectionSize(): number {
  return useAtomValue(selectionSizeAtom);
}
