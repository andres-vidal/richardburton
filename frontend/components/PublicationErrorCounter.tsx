import ErrorCircleIcon from "assets/error-circle.svg";
import { toString } from "lodash";
import {
  focusNextInvalid,
  useValidPublicationCount,
  useVisiblePublicationCount,
} from "modules/publication";
import { FC } from "react";
import Button from "./Button";
import Tooltip from "./Tooltip";

const PublicationErrorCounter: FC = () => {
  const publicationCount = useVisiblePublicationCount();
  const validPublicationCount = useValidPublicationCount();
  const invalidPublicationCount = publicationCount - validPublicationCount;

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
        onClick={focusNextInvalid}
      />
    </Tooltip>
  ) : null;
};

export default PublicationErrorCounter;
