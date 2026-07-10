"use client";

import DeselectIcon from "assets/deselect.svg";
import { FC } from "react";
import { clearSelection, useSelectionSize } from "modules/selection";
import Button from "./Button";

const PublicationDeselect: FC = () => {
  const selectionSize = useSelectionSize();

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
