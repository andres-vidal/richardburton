"use client";

import { isElement } from "lodash";
import { clearSelection } from "modules/selection";
import type { Store } from "modules/store";
import { FC, useEffect } from "react";

/**
 * Clicking outside the rows clears the selection.
 *
 * Rendered by the surface that selects — the bulk workspace — and given its
 * store: a selection belongs to the rows one workspace holds, so clearing it has
 * to reach the same store the rows were selected in.
 */
const ClearSelection: FC<{ store: Store }> = ({ store }) => {
  useEffect(() => {
    const handle = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      if (isElement(target) && !target.matches('[data-selectable="true"]')) {
        clearSelection(store);
      }
    };

    document.addEventListener("click", handle);
    return () => {
      document.removeEventListener("click", handle);
    };
  }, [store]);

  return null;
};

export default ClearSelection;
