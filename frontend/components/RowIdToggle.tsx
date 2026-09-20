"use client";

import { useTranslations } from "next-intl";
import { FC } from "react";
import Tooltip from "./Tooltip";
import {
  useAreRowIdsVisible,
  useVisiblePublicationCount,
} from "modules/publication/hooks";
import NumberedListIcon from "assets/numbered-list.svg";
import Toggle from "./Toggle";

const RowIdToggle: FC = () => {
  const t = useTranslations("admin");
  const publicationCount = useVisiblePublicationCount();
  const [active, set] = useAreRowIdsVisible();

  return publicationCount !== 0 ? (
    <Tooltip
      variant="info"
      message={active ? t("hideRowIds") : t("showRowIds")}
    >
      <Toggle
        label={t("rowIds")}
        checked={active}
        onClick={() => set((active) => !active)}
        width="fit"
        labelSrOnly
        CheckedIcon={NumberedListIcon}
        UncheckedIcon={NumberedListIcon}
      />
    </Tooltip>
  ) : null;
};

export default RowIdToggle;
