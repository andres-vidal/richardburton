"use client";

import { clearSelection, isSelectionGesture } from "modules/selection";
import type { Store } from "modules/store";
import { FC, useEffect } from "react";

/**
 * A click that is not asking for a row clears the selection.
 *
 * Rendered by the surface that selects — the bulk workspace — and given its
 * store: a selection belongs to the rows one workspace holds, so clearing it has
 * to reach the same store the rows were selected in.
 */
const ClearSelection: FC<{ store: Store }> = ({ store }) => {
  useEffect(() => {
    const handle = (event: MouseEvent) => {
      // `closest`, via the shared gesture test: the handle has content of its
      // own (a row number, an error icon), and a click that landed on *that*
      // is still a click on the handle. Testing the exact target made selecting
      // depend on missing the icon.
      if (!isSelectionGesture(event.target)) clearSelection(store);
    };

    document.addEventListener("click", handle);
    return () => {
      document.removeEventListener("click", handle);
    };
  }, [store]);

  return null;
};

export default ClearSelection;
