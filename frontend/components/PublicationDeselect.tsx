"use client";

import DeselectIcon from "assets/deselect.svg";
import { useTranslations } from "next-intl";
import { FC } from "react";
import { usePublicationStore } from "modules/publication/workspace";
import { clearSelection, useSelectionSize } from "modules/selection";
import Button from "./Button";

/**
 * A button that clears the selection of rows. Its label counts the selected
 * rows ("Deselect 2").
 */
const PublicationDeselect: FC = () => {
  const t = useTranslations("admin");
  const store = usePublicationStore();
  const selectionSize = useSelectionSize();

  return (
    <Button
      variant="outline"
      width="fit"
      label={t("deselect", { count: selectionSize })}
      Icon={DeselectIcon}
      onClick={() => clearSelection(store)}
    />
  );
};

export default PublicationDeselect;
