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
 * How many rows of the working set look like a publication already known, and
 * the way into them.
 *
 * Counts rather than offers: the rows are measured as they are edited, the way
 * they are validated. Silent when nothing looks like anything, since a look-alike
 * is a question to answer and no question is not news — the error counter is
 * what says the set is in good order.
 *
 * It carries the same warning the marked rows do, so the count and the rows it
 * is counting read as one thing.
 */
const PublicationResemblanceCounter: FC = () => {
  const t = useTranslations("resemblances");
  const store = usePublicationStore();
  const count = useResemblingPublicationCount();
  const reviewing = useReviewing();

  // The dialog is rendered whatever the count, because answering the last
  // question takes the count to nought — and the review is still open, saying
  // so.
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
