"use client";

import DeselectIcon from "assets/deselect.svg";
import { FC } from "react";
import { usePublicationStore } from "modules/publication/workspace";
import { clearSelection, useSelectionSize } from "modules/selection";
import Button from "./Button";

const PublicationDeselect: FC = () => {
  const store = usePublicationStore();
  const selectionSize = useSelectionSize();

  return (
    <Button
      variant="outline"
      width="fit"
      label={`Deselect ${selectionSize}`}
      Icon={DeselectIcon}
      onClick={() => clearSelection(store)}
    />
  );
};

export default PublicationDeselect;
