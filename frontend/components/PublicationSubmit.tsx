"use client";

import {
  useIsValidating,
  useValidPublicationCount,
  useVisiblePublicationCount,
} from "modules/publication/hooks";
import { setAll } from "modules/publication/store";
import { usePublicationStore } from "modules/publication/workspace";
import { bulk } from "modules/publication/remote";
import { FC, useCallback } from "react";
import Button from "./Button";
import { useNotify } from "./Notifications";
import Tooltip from "./Tooltip";

const PublicationSubmit: FC = () => {
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

  const publicationCount = useVisiblePublicationCount();
  const validPublicationCount = useValidPublicationCount();
  const invalidPublicationCount = publicationCount - validPublicationCount;

  const isValidating = useIsValidating();

  const isSubmitDisabled =
    isValidating || publicationCount === 0 || invalidPublicationCount > 0;

  return (
    <Tooltip
      variant="info"
      message="Save the publications to the repository"
      placement="top"
    >
      <Button
        label="Submit"
        onClick={handleSubmit}
        disabled={isSubmitDisabled}
        width="fixed"
      />
    </Tooltip>
  );
};

export default PublicationSubmit;
