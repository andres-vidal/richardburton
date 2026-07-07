import CheckIcon from "assets/check.svg";
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

  // Nothing loaded yet — nothing to report.
  if (publicationCount === 0) return null;

  // All valid — a green check reassures instead of showing a red "0".
  if (invalidPublicationCount === 0) {
    return (
      <Tooltip info message="All publications are valid">
        <span
          role="status"
          aria-label="All publications are valid"
          className="flex items-center rounded bg-green-600 px-2 py-1.5 text-white shadow-sm"
        >
          <CheckIcon className="w-4 h-4" />
        </span>
      </Tooltip>
    );
  }

  return (
    <Tooltip
      error
      message={`${invalidPublicationCount} ${
        invalidPublicationCount === 1 ? "publication" : "publications"
      } with errors`}
    >
      <Button
        variant="danger"
        width="fit"
        alignment="left"
        Icon={ErrorCircleIcon}
        label={toString(invalidPublicationCount)}
        aria-label={`${invalidPublicationCount} invalid publications`}
        onClick={focusNextInvalid}
      />
    </Tooltip>
  );
};

export default PublicationErrorCounter;
