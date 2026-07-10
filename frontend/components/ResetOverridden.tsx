"use client";

import RestorePageIcon from "assets/restore-page.svg";
import {
  resetOverridden,
  useOverriddenPublicationCount,
  useOverriddenPublicationIds,
  validate,
} from "modules/publication";
import { FC } from "react";
import { clearSelection } from "modules/selection";
import Button from "./Button";

const ResetOverridden: FC = () => {
  const overriddenCount = useOverriddenPublicationCount();

  const overriddenIds = useOverriddenPublicationIds();

  const reset = () => {
    if (!overriddenIds)
      throw "Can not reset publications: overriden ids are undefined.";
    resetOverridden();
    clearSelection();
    validate(overriddenIds);
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
