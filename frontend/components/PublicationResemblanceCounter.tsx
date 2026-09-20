"use client";

import CheckIcon from "assets/check.svg";
import DuplicateIcon from "assets/copy.svg";
import { toString } from "lodash";
import {
  useIsResemblanceChecked,
  useResemblingPublicationCount,
  useVisiblePublicationCount,
  useVisiblePublicationIds,
} from "modules/publication/hooks";
import { resemblances } from "modules/publication/remote";
import { usePublicationStore } from "modules/publication/workspace";
import { useTranslations } from "next-intl";
import type { Store } from "modules/store";
import type { PublicationId } from "modules/publication/model";
import { FC, useState } from "react";
import Button from "./Button";
import PublicationResemblances from "./PublicationResemblances";
import Tooltip from "./Tooltip";

type Props = {
  /** How the check is run. Defaults to asking the server. */
  check?: (store: Store, ids: PublicationId[]) => Promise<void>;
};

/**
 * How many rows of the working set look like a publication already known, and
 * the way into them.
 *
 * The check is asked for rather than run on every edit: it measures each row
 * against the database, which is work worth doing once a set is assembled, not
 * on every keystroke. Until it is asked, the button offers to ask.
 */
const PublicationResemblanceCounter: FC<Props> = ({
  check: runCheck = resemblances,
}) => {
  const t = useTranslations("resemblances");
  const store = usePublicationStore();
  const ids = useVisiblePublicationIds();
  const checked = useIsResemblanceChecked();
  const count = useResemblingPublicationCount();
  const publicationCount = useVisiblePublicationCount();

  const [checking, setChecking] = useState(false);
  const [isOpen, setOpen] = useState(false);

  async function check() {
    setChecking(true);
    try {
      await runCheck(store, ids ?? []);
    } finally {
      setChecking(false);
    }
  }

  return publicationCount === 0 ? null : (
    <>
      {checked && count === 0 ? (
        <Tooltip variant="info" message={t("noneFound")}>
          <span
            role="status"
            aria-label={t("noneFound")}
            className="flex items-center px-2 py-1.5 text-white bg-green-600 rounded shadow-sm"
          >
            <CheckIcon className="w-4 h-4" />
          </span>
        </Tooltip>
      ) : (
        <Tooltip
          variant="info"
          message={checked ? t("found", { count }) : t("checkHint")}
        >
          <Button
            variant={checked ? "danger" : "secondary"}
            width="fit"
            alignment="left"
            Icon={DuplicateIcon}
            loading={checking}
            label={checked ? toString(count) : t("check")}
            aria-label={checked ? t("found", { count }) : t("check")}
            onClick={checked ? () => setOpen(true) : check}
          />
        </Tooltip>
      )}

      <PublicationResemblances isOpen={isOpen} onClose={() => setOpen(false)} />
    </>
  );
};

export default PublicationResemblanceCounter;
export type { Props as PublicationResemblanceCounterProps };
