"use client";

import SparklesIcon from "assets/sparkles.svg";
import { usePublicationCount } from "modules/publication/hooks";
import { useFormatter, useTranslations } from "next-intl";
import { FC } from "react";
import Button from "./Button";
import Tooltip from "./Tooltip";

/**
 * A button that shows how many rows the workspace holds, with a tooltip that
 * reads them as new publications. It renders nothing while there are no rows.
 */
const PublicationCounter: FC = () => {
  const t = useTranslations("admin");
  const format = useFormatter();
  const publicationCount = usePublicationCount();

  return publicationCount !== 0 ? (
    <Tooltip
      variant="info"
      message={t("newPublications", { count: publicationCount })}
    >
      <Button
        variant="outline"
        width="fit"
        Icon={SparklesIcon}
        label={format.number(publicationCount)}
      />
    </Tooltip>
  ) : null;
};

export default PublicationCounter;
