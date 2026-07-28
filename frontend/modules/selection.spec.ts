import { createStore } from "jotai";

import { getSelection, select } from "./selection";
import type { Store } from "./store";

// A store per test: selection belongs to a workspace, so a spec makes its own.
let store: Store;

// A stable row order for shift-range selection.
const orderedIds = [1, 2, 3, 4, 5];

/** Apply a row click to this test's selection store. */
function click(
  id: number,
  modifiers: { metaKey?: boolean; shiftKey?: boolean } = {},
) {
  select(store, { id, type: "publication", orderedIds, ...modifiers });
}

function selected(): number[] {
  return [...getSelection(store)].map(Number).sort((a, b) => a - b);
}

describe("selection store", () => {
  beforeEach(() => {
    store = createStore();
  });

  test("a plain click selects only the clicked row", () => {
    click(3);
    expect(selected()).toEqual([3]);

    click(5);
    expect(selected()).toEqual([5]);
  });

  test("cmd-click toggles a row in and out without dropping the rest", () => {
    click(3);
    click(5, { metaKey: true });
    expect(selected()).toEqual([3, 5]);

    click(3, { metaKey: true });
    expect(selected()).toEqual([5]);
  });

  test("shift-click selects the contiguous range from the pivot", () => {
    click(2);
    click(4, { shiftKey: true });
    expect(selected()).toEqual([2, 3, 4]);
  });

  test("a second shift-click re-anchors the range on the same pivot", () => {
    click(2);
    click(4, { shiftKey: true });
    expect(selected()).toEqual([2, 3, 4]);

    // Extends the other way from the pivot (2), replacing the previous block.
    click(1, { shiftKey: true });
    expect(selected()).toEqual([1, 2]);
  });

  test("selecting a different entity type restarts the selection", () => {
    click(3);
    select(store, { id: 1, type: "other", orderedIds });
    expect(selected()).toEqual([1]);
  });

  test("the selection size tracks the store", () => {
    expect(getSelection(store).size).toBe(0);

    click(2);
    click(3, { metaKey: true });
    expect(getSelection(store).size).toBe(2);
  });
});
