"use client";

import CopyIcon from "assets/copy.svg";
import { duplicate } from "modules/publication/store";
import { usePublicationStore } from "modules/publication/workspace";
import { useTranslations } from "next-intl";
import { FC } from "react";
import {
  clearSelection,
  getSelection,
  useSelectionSize,
} from "modules/selection";
import Button from "./Button";

/**
 * A button that copies the selected rows, each copy right after its row, and
 * clears the selection. Its label counts the selected rows ("Duplicate 2").
 * The copies are one edit, so one undo removes them all.
 */
const PublicationDuplicate: FC = () => {
  const t = useTranslations("admin");
  const selectionSize = useSelectionSize();

  const store = usePublicationStore();

  const duplicateSelected = () => {
    const selectedIds = getSelection(store) as Set<number>;
    if (selectedIds.size > 0) {
      duplicate(store, selectedIds);
      clearSelection(store);
    }
  };

  return (
    <Button
      label={t("duplicate", { count: selectionSize })}
      variant="secondary"
      alignment="left"
      width="fit"
      Icon={CopyIcon}
      onClick={duplicateSelected}
    />
  );
};

export default PublicationDuplicate;
