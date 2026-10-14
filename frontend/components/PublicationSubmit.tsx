"use client";

import {
  usePublicationCount,
  useUncheckedPublicationCount,
  useValidPublicationCount,
} from "modules/publication/hooks";
import { publicationIdsAtom, setAll } from "modules/publication/store";
import { usePublicationStore } from "modules/publication/workspace";
import { bulk, validate } from "modules/publication/remote";
import { useTranslations } from "next-intl";
import { FC, useState } from "react";
import Button from "./Button";
import { notify } from "./Notifications";
import Tooltip from "./Tooltip";

/**
 * The button that inserts the rows of the workspace. It is enabled when there
 * are rows, every row has a validation result for its current content with no
 * errors, and no insert is in flight.
 *
 * A validation request in flight does not disable it. A row whose stored result
 * still matches its content keeps counting as checked while it is validated
 * again, and the insert validates every row once more before writing.
 *
 * When the insert succeeds, the workspace is emptied. When it fails, the rows
 * stay, `bulk` reports the error, and every row is validated again, so a row
 * the insert refused, such as one another person has just stored, is marked
 * and keeps the button disabled.
 */
const PublicationSubmit: FC = () => {
  const t = useTranslations("admin");
  const store = usePublicationStore();
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit() {
    const ids = store.get(publicationIdsAtom) ?? [];
    setSubmitting(true);

    bulk(store)
      .then(
        (publications) => {
          setAll(store, []);
          notify({
            message: "notify.inserted",
            values: { count: publications.length },
            level: "success",
          });
        },
        () => validate(store, ids, { force: true }),
      )
      // `bulk` has already reported its error, and a failed validation leaves
      // the rows as they were.
      .catch(() => {})
      .finally(() => setSubmitting(false));
  }

  const publicationCount = usePublicationCount();
  const validPublicationCount = useValidPublicationCount();
  const invalidPublicationCount = publicationCount - validPublicationCount;

  const uncheckedPublicationCount = useUncheckedPublicationCount();

  const isSubmitDisabled =
    submitting ||
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
