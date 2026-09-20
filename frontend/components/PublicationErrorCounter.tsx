"use client";

import CheckIcon from "assets/check.svg";
import ErrorCircleIcon from "assets/error-circle.svg";
import { toString } from "lodash";
import {
  useValidPublicationCount,
  useVisiblePublicationCount,
} from "modules/publication/hooks";
import { focusNextInvalid } from "modules/publication/store";
import { usePublicationStore } from "modules/publication/workspace";
import { useTranslations } from "next-intl";
import { FC } from "react";
import Button from "./Button";
import Tooltip from "./Tooltip";

const PublicationErrorCounter: FC = () => {
  const t = useTranslations("admin");
  const store = usePublicationStore();
  const publicationCount = useVisiblePublicationCount();
  const validPublicationCount = useValidPublicationCount();
  const invalidPublicationCount = publicationCount - validPublicationCount;

  // Nothing loaded yet — nothing to report.
  if (publicationCount === 0) return null;

  // All valid — a green check reassures instead of showing a red "0".
  if (invalidPublicationCount === 0) {
    return (
      <Tooltip variant="info" message={t("allValid")}>
        <span
          role="status"
          aria-label={t("allValid")}
          className="flex items-center rounded bg-green-600 px-2 py-1.5 text-white shadow-sm"
        >
          <CheckIcon className="w-4 h-4" />
        </span>
      </Tooltip>
    );
  }

  return (
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
        onClick={() => focusNextInvalid(store)}
      />
    </Tooltip>
  );
};

export default PublicationErrorCounter;
