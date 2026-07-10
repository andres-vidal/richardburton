"use client";

import CopyIcon from "assets/copy.svg";
import { duplicate, validate } from "modules/publication";
import { FC } from "react";
import {
  clearSelection,
  getSelection,
  useSelectionSize,
} from "modules/selection";
import Button from "./Button";

const PublicationDuplicate: FC = () => {
  const selectionSize = useSelectionSize();

  const duplicateSelected = () => {
    const selectedIds = getSelection() as Set<number>;
    if (selectedIds.size > 0) {
      const newIds = duplicate(selectedIds);
      validate(newIds);
      clearSelection();
    }
  };

  return (
    <Button
      label={`Duplicate ${selectionSize}`}
      variant="secondary"
      alignment="left"
      width="fit"
      Icon={CopyIcon}
      onClick={duplicateSelected}
    />
  );
};

export default PublicationDuplicate;
