"use client";

import WarningIcon from "assets/warning.svg";
import { toString } from "lodash";
import { useResemblingPublicationCount } from "modules/publication/hooks";
import { openReview } from "modules/publication/store";
import { usePublicationStore } from "modules/publication/workspace";
import { useTranslations } from "next-intl";
import { FC } from "react";
import Button from "./Button";
import Tooltip from "./Tooltip";

/**
 * A button with the number of rows that resemble something, which opens
 * the resemblance review at the first of them.
 *
 * The count updates as rows are edited, because `CheckResemblances` checks the
 * rows after each edit. The button is hidden when the count is zero, since the
 * error counter already reports when the set is valid.
 *
 * The button uses the same warning icon as the rows it counts.
 */
const PublicationResemblanceCounter: FC = () => {
  const t = useTranslations("resemblances");
  const store = usePublicationStore();
  const count = useResemblingPublicationCount();

  return count === 0 ? null : (
    <Tooltip variant="info" message={t("found", { count })}>
      <Button
        variant="secondary"
        width="fit"
        alignment="left"
        Icon={WarningIcon}
        label={toString(count)}
        aria-label={t("found", { count })}
        onClick={() => openReview(store)}
      />
    </Tooltip>
  );
};

export default PublicationResemblanceCounter;
