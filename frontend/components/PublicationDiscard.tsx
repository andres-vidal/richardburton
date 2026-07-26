"use client";

import TrashIcon from "assets/trash.svg";
import { setDiscarded } from "modules/publication/store";
import { usePublicationStore } from "modules/publication/workspace";
import { FC } from "react";
import {
  clearSelection,
  getSelection,
  useSelectionSize,
} from "modules/selection";
import Button from "./Button";

const PublicationDiscard: FC = () => {
  const selectionSize = useSelectionSize();

  const store = usePublicationStore();

  const discardSelected = () => {
    const selectedIds = [...getSelection(store)] as number[];
    if (selectedIds.length > 0) {
      setDiscarded(store, selectedIds);
      clearSelection(store);
    }
  };

  return (
    <Button
      label={`Discard ${selectionSize}`}
      variant="danger"
      alignment="left"
      width="fit"
      Icon={TrashIcon}
      onClick={discardSelected}
    />
  );
};

export default PublicationDiscard;
