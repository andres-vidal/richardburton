// Ported from `react-selection-manager` to `jotai`.

import { atom, useAtomValue } from "jotai";
import { atomFamily } from "jotai-family";
import { store } from "modules/store";

type SelectableId = string | number;

type SelectionEvent = {
  id: SelectableId;
  type: string;
  metaKey?: boolean;
  shiftKey?: boolean;
  orderedIds?: SelectableId[];
};

type SelectionState = {
  selection: Set<SelectableId>;
  // The entity kind the current selection belongs to — selecting a different
  // kind restarts the selection. `pivot` is the anchor for shift-range selects.
  type: string | null;
  pivot: SelectableId | null;
};

const empty = (): SelectionState => ({
  selection: new Set(),
  type: null,
  pivot: null,
});

// Base state atom — `select` replaces it wholesale on each click.
const selectionStateAtom = atom<SelectionState>(empty());

// Derived reads — each yields a primitive/stable slice, so a subscriber only
// re-renders when its own slice changes (a row on its own selected-ness).
const selectionAtom = atom((get) => get(selectionStateAtom).selection);
const selectionSizeAtom = atom((get) => get(selectionStateAtom).selection.size);
const isSelectionEmptyAtom = atom(
  (get) => get(selectionStateAtom).selection.size === 0,
);
const isSelectedFamily = atomFamily((id: SelectableId) =>
  atom((get) => get(selectionStateAtom).selection.has(id)),
);

// The ported react-selection-manager click semantics, as a pure reducer: plain
// click selects only the clicked row; cmd/ctrl toggles it; shift extends a
// contiguous range from the pivot along `orderedIds` (the current row order).
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

// --- Actions (write the shared store, like modules/publication) -------------

export function select(event: SelectionEvent): void {
  store.set(selectionStateAtom, reduce(store.get(selectionStateAtom), event));
}

export function clearSelection(): void {
  store.set(selectionStateAtom, empty());
}

/** Imperative, non-reactive read of the current selection. */
export function getSelection(): Set<SelectableId> {
  return store.get(selectionAtom);
}

// --- Reads (thin useAtomValue hooks, like modules/publication) --------------

export function useIsSelected(id: SelectableId): boolean {
  return useAtomValue(isSelectedFamily(id));
}

export function useIsSelectionEmpty(): boolean {
  return useAtomValue(isSelectionEmptyAtom);
}

export function useSelectionSize(): number {
  return useAtomValue(selectionSizeAtom);
}
