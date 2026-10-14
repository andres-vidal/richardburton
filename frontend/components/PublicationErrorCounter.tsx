"use client";

import CheckIcon from "assets/check.svg";
import ErrorCircleIcon from "assets/error-circle.svg";
import { toString } from "lodash";
import {
  useValidPublicationCount,
  usePublicationCount,
} from "modules/publication/hooks";
import { useTranslations } from "next-intl";
import { FC, useState } from "react";
import Button from "./Button";
import PublicationErrors from "./PublicationErrors";
import Tooltip from "./Tooltip";

/**
 * Renders how many loaded publications have errors, as a red button that opens
 * the list of errors. It renders a green check when every loaded publication is
 * valid, and nothing when no publications are loaded.
 */
const PublicationErrorCounter: FC = () => {
  const t = useTranslations("admin");
  const [isOpen, setOpen] = useState(false);
  const publicationCount = usePublicationCount();
  const validPublicationCount = useValidPublicationCount();
  const invalidPublicationCount = publicationCount - validPublicationCount;

  return publicationCount === 0 ? null : invalidPublicationCount === 0 ? (
    <Tooltip variant="info" message={t("allValid")}>
      <span
        role="status"
        aria-label={t("allValid")}
        className="flex items-center rounded bg-green-600 px-2 py-1.5 text-white shadow-sm"
      >
        <CheckIcon className="w-4 h-4" />
      </span>
    </Tooltip>
  ) : (
    <>
      <Tooltip
        variant="error"
        message={t("withErrors", { count: invalidPublicationCount })}
      >
        <Button
          variant="danger"
          width="fit"
          alignment="left"
          Icon={ErrorCircleIcon}
          label={toString(invalidPublicationCount)}
          aria-label={t("invalidPublications", {
            count: invalidPublicationCount,
          })}
          onClick={() => setOpen(true)}
        />
      </Tooltip>

      <PublicationErrors isOpen={isOpen} onClose={() => setOpen(false)} />
    </>
  );
};

export default PublicationErrorCounter;
