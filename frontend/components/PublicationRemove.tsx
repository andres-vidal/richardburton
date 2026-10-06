"use client";

import TrashIcon from "assets/trash.svg";
import { remove } from "modules/publication/store";
import { usePublicationStore } from "modules/publication/workspace";
import {
  clearSelection,
  getSelection,
  useSelectionSize,
} from "modules/selection";
import { useTranslations } from "next-intl";
import { FC } from "react";
import Button from "./Button";
import Tooltip from "./Tooltip";

/**
 * A button that removes the selected rows from the import document, for
 * everyone in it, and clears the selection. Its label counts the selected rows
 * ("Remove 2"). It asks for no confirmation: the removal is one edit of this
 * person, so their Undo brings the rows back.
 */
const PublicationRemove: FC = () => {
  const t = useTranslations("admin");
  const selectionSize = useSelectionSize();
  const store = usePublicationStore();

  const removeSelected = () => {
    const selectedIds = getSelection(store) as Set<number>;

    if (selectedIds.size > 0) {
      remove(store, selectedIds);
      clearSelection(store);
    }
  };

  return (
    <Tooltip variant="info" message={t("removeHint")} placement="top">
      <Button
        label={t("remove", { count: selectionSize })}
        variant="secondary"
        alignment="left"
        width="fit"
        Icon={TrashIcon}
        onClick={removeSelected}
      />
    </Tooltip>
  );
};

export default PublicationRemove;
