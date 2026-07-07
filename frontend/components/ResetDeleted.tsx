import RestoreTrashIcon from "assets/restore-trash.svg";
import { resetDeleted, useDeletedPublicationCount } from "modules/publication";
import { FC } from "react";
import { useClearSelection } from "react-selection-manager";
import Button from "./Button";

const ResetDeleted: FC = () => {
  const deletedCount = useDeletedPublicationCount();
  const clearSelection = useClearSelection();

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
