"use client";

import DeselectIcon from "assets/deselect.svg";
import { FC } from "react";
import { useClearSelection, useSelectionSize } from "react-selection-manager";
import Button from "./Button";

const PublicationDeselect: FC = () => {
  const selectionSize = useSelectionSize();
  const clearSelection = useClearSelection();

  return (
    <Button
      variant="outline"
      width="fit"
      label={`Deselect ${selectionSize}`}
      Icon={DeselectIcon}
      onClick={clearSelection}
    />
  );
};

export default PublicationDeselect;
