import ErrorCircleIcon from "assets/error-circle.svg";
import { useStore } from "jotai";
import { toString } from "lodash";
import { Publication } from "modules/publication";
import { FC, useCallback } from "react";
import Button from "./Button";
import Tooltip from "./Tooltip";

const PublicationErrorCounter: FC = () => {
  const publicationCount = Publication.STORE.useVisibleCount();
  const validPublicationCount = Publication.STORE.useValidCount();
  const invalidPublicationCount = publicationCount - validPublicationCount;

  const s = useStore();
  const focusNextInvalidRow = useCallback(() => {
    const { from } = Publication.STORE;
    const { setFocusedRowId } = Publication.STORE.with(s);
    const { getVisibleIds, isValid, getFocusedRowId } = from(s);

    const visibleIds = getVisibleIds();
    const focusedId = getFocusedRowId() ?? -1;

    if (visibleIds) {
      const nextInvalidId =
        visibleIds?.find((id) => id > focusedId && !isValid(id)) ||
        visibleIds?.find((id) => !isValid(id));

      setFocusedRowId(nextInvalidId);
    }
  }, [s]);

  return invalidPublicationCount !== 0 ? (
    <Tooltip
      error
      message={`${invalidPublicationCount} ${
        publicationCount === 1 ? "publication" : "publications"
      } with errors`}
    >
      <Button
        variant="danger"
        width="fit"
        Icon={ErrorCircleIcon}
        label={toString(invalidPublicationCount)}
        aria-label={`${invalidPublicationCount} invalid publications`}
        onClick={focusNextInvalidRow}
      />
    </Tooltip>
  ) : null;
};

export default PublicationErrorCounter;
