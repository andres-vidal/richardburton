"use client";

import { isElement } from "lodash";
import { FC, useEffect } from "react";
import { useClearSelection } from "react-selection-manager";

const ClearSelection: FC = () => {
  const clearSelection = useClearSelection();
  useEffect(() => {
    const handle = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      if (isElement(target) && !target.matches('[data-selectable="true"]')) {
        clearSelection();
      }
    };

    document.addEventListener("click", handle);
    return () => {
      document.removeEventListener("click", handle);
    };
  }, [clearSelection]);

  return null;
};

export default ClearSelection;
