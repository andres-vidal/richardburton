"use client";

import SparklesIcon from "assets/sparkles.svg";
import { useVisiblePublicationCount } from "modules/publication";
import { FC } from "react";
import Button from "./Button";
import Tooltip from "./Tooltip";

const PublicationCounter: FC = () => {
  const publicationCount = useVisiblePublicationCount();

  const message = `${publicationCount} new ${
    publicationCount === 1 ? "publication" : "publications"
  }`;

  return publicationCount !== 0 ? (
    <Tooltip variant="info" message={message}>
      <Button
        variant="outline"
        width="fit"
        Icon={SparklesIcon}
        label={`${publicationCount}`}
      />
    </Tooltip>
  ) : null;
};

export default PublicationCounter;
