"use client";

import TrashIcon from "assets/trash.svg";
import { setDeleted } from "modules/publication";
import { FC } from "react";
import {
  clearSelection,
  getSelection,
  useSelectionSize,
} from "modules/selection";
import Button from "./Button";

const PublicationDelete: FC = () => {
  const selectionSize = useSelectionSize();

  const deleteSelected = () => {
    const selectedIds = [...getSelection()] as number[];
    if (selectedIds.length > 0) {
      setDeleted(selectedIds);
      clearSelection();
    }
  };

  return (
    <Button
      label={`Delete ${selectionSize}`}
      variant="danger"
      alignment="left"
      width="fit"
      Icon={TrashIcon}
      onClick={deleteSelected}
    />
  );
};

export default PublicationDelete;
