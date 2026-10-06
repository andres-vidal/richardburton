"use client";

import {
  usePublicationCount,
  useUncheckedPublicationCount,
  useValidPublicationCount,
} from "modules/publication/hooks";
import { setAll } from "modules/publication/store";
import { usePublicationStore } from "modules/publication/workspace";
import { bulk } from "modules/publication/remote";
import { useTranslations } from "next-intl";
import { FC, useCallback } from "react";
import Button from "./Button";
import { useNotify } from "./Notifications";
import Tooltip from "./Tooltip";

/**
 * The button that inserts the rows of the workspace. It is enabled when there
 * are rows, and every row has a validation result for its current content with
 * no errors.
 *
 * A validation request in flight does not disable it. A row whose stored result
 * still matches its content keeps counting as checked while it is validated
 * again, and the insert validates every row once more before writing.
 */
const PublicationSubmit: FC = () => {
  const t = useTranslations("admin");
  const store = usePublicationStore();
  const notify = useNotify();

  const handleSubmit = useCallback(() => {
    bulk(store).then((publications) => {
      setAll(store, []);
      notify({
        message: `${publications.length} ${
          publications.length === 1 ? "publication" : "publications"
        } inserted successfully`,
        level: "success",
      });
    });
  }, [notify, store]);

  const publicationCount = usePublicationCount();
  const validPublicationCount = useValidPublicationCount();
  const invalidPublicationCount = publicationCount - validPublicationCount;

  const uncheckedPublicationCount = useUncheckedPublicationCount();

  const isSubmitDisabled =
    publicationCount === 0 ||
    invalidPublicationCount > 0 ||
    uncheckedPublicationCount > 0;

  return (
    <Tooltip variant="info" message={t("submitHint")} placement="top">
      <Button
        label={t("submit")}
        onClick={handleSubmit}
        disabled={isSubmitDisabled}
        width="fixed"
      />
    </Tooltip>
  );
};

export default PublicationSubmit;
