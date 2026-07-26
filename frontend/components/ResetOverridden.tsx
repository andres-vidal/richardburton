"use client";

import RestorePageIcon from "assets/restore-page.svg";
import {
  useOverriddenPublicationCount,
  useOverriddenPublicationIds,
} from "modules/publication/hooks";
import { resetOverridden } from "modules/publication/store";
import { usePublicationStore } from "modules/publication/workspace";
import { validate } from "modules/publication/remote";
import { FC } from "react";
import { clearSelection } from "modules/selection";
import Button from "./Button";

const ResetOverridden: FC = () => {
  const overriddenCount = useOverriddenPublicationCount();

  const overriddenIds = useOverriddenPublicationIds();

  const store = usePublicationStore();

  const reset = () => {
    if (!overriddenIds)
      throw "Can not reset publications: overriden ids are undefined.";
    resetOverridden(store);
    clearSelection(store);
    validate(store, overriddenIds);
  };

  return overriddenCount !== 0 ? (
    <Button
      label={`Reset ${overriddenCount} overriden`}
      variant="outline"
      Icon={RestorePageIcon}
      alignment="left"
      width="fit"
      onClick={reset}
    />
  ) : null;
};

export default ResetOverridden;
