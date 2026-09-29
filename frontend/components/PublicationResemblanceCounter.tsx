"use client";

import WarningIcon from "assets/warning.svg";
import { toString } from "lodash";
import {
  useResemblingPublicationCount,
  useReviewing,
} from "modules/publication/hooks";
import { closeReview, openReview } from "modules/publication/store";
import { usePublicationStore } from "modules/publication/workspace";
import { useTranslations } from "next-intl";
import { FC } from "react";
import Button from "./Button";
import PublicationResemblances from "./PublicationResemblances";
import Tooltip from "./Tooltip";

/**
 * A button with the number of visible rows that resemble something, which opens
 * the resemblance review at the first of them. It also renders the review.
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
  const reviewing = useReviewing();

  // The review is rendered even when the count is zero, so it stays open if the
  // count drops to zero while the review is open.
  return (
    <>
      {count === 0 ? null : (
        <Tooltip variant="info" message={t("found", { count })}>
          <Button
            variant="secondary"
            width="fit"
            alignment="left"
            Icon={WarningIcon}
            label={toString(count)}
            aria-label={t("found", { count })}
            onClick={() => openReview(store, "first")}
          />
        </Tooltip>
      )}

      <PublicationResemblances
        isOpen={reviewing !== null}
        startAt={reviewing === "first" ? undefined : (reviewing ?? undefined)}
        onClose={() => closeReview(store)}
      />
    </>
  );
};

export default PublicationResemblanceCounter;
