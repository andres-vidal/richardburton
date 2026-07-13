"use client";

import RestoreTrashIcon from "assets/restore-trash.svg";
import { useDeletedPublicationCount } from "modules/publication/hooks";
import { resetDeleted } from "modules/publication/store";
import { FC } from "react";
import { clearSelection } from "modules/selection";
import Button from "./Button";

const ResetDeleted: FC = () => {
  const deletedCount = useDeletedPublicationCount();

  const reset = () => {
    resetDeleted();
    clearSelection();
  };

  return deletedCount !== 0 ? (
    <Button
      label={`Reset ${deletedCount} deleted`}
      variant="outline"
      Icon={RestoreTrashIcon}
      alignment="left"
      width="fit"
      onClick={reset}
    />
  ) : null;
};

export default ResetDeleted;
