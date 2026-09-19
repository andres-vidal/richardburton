"use client";

import CopyIcon from "assets/copy.svg";
import { duplicate } from "modules/publication/store";
import { usePublicationStore } from "modules/publication/workspace";
import { validate } from "modules/publication/remote";
import { useTranslations } from "next-intl";
import { FC } from "react";
import {
  clearSelection,
  getSelection,
  useSelectionSize,
} from "modules/selection";
import Button from "./Button";

const PublicationDuplicate: FC = () => {
  const t = useTranslations("admin");
  const selectionSize = useSelectionSize();

  const store = usePublicationStore();

  const duplicateSelected = () => {
    const selectedIds = getSelection(store) as Set<number>;
    if (selectedIds.size > 0) {
      const newIds = duplicate(store, selectedIds);
      validate(store, newIds);
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
