"use client";

import { isElement } from "lodash";
import { clearSelection } from "modules/selection";
import { FC, useEffect } from "react";

const ClearSelection: FC = () => {
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
  }, []);

  return null;
};

export default ClearSelection;
