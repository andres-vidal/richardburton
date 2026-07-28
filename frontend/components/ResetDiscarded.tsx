"use client";

import RestoreTrashIcon from "assets/restore-trash.svg";
import { useDiscardedPublicationCount } from "modules/publication/hooks";
import { usePublicationStore } from "modules/publication/workspace";
import { resetDiscarded } from "modules/publication/store";
import { FC } from "react";
import { clearSelection } from "modules/selection";
import Button from "./Button";

const ResetDiscarded: FC = () => {
  const discardedCount = useDiscardedPublicationCount();

  const store = usePublicationStore();

  const reset = () => {
    resetDiscarded(store);
    clearSelection(store);
  };

  return discardedCount !== 0 ? (
    <Button
      label={`Reset ${discardedCount} discarded`}
      variant="outline"
      Icon={RestoreTrashIcon}
      alignment="left"
      width="fit"
      onClick={reset}
    />
  ) : null;
};

export default ResetDiscarded;
