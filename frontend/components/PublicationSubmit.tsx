"use client";

import {
  bulk,
  setAll,
  useIsValidating,
  useValidPublicationCount,
  useVisiblePublicationCount,
} from "modules/publication";
import { FC, useCallback } from "react";
import Button from "./Button";
import { useNotify } from "./Notifications";
import Tooltip from "./Tooltip";

const PublicationSubmit: FC = () => {
  const notify = useNotify();

  const handleSubmit = useCallback(() => {
    bulk().then((publications) => {
      setAll([]);
      notify({
        message: `${publications.length} ${
          publications.length === 1 ? "publication" : "publications"
        } inserted successfully`,
        level: "success",
      });
    });
  }, [notify]);

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
