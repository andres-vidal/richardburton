"use client";

import { initial } from "modules/publication/presence";
import { useTranslations } from "next-intl";
import { FC } from "react";
import Tooltip from "./Tooltip";

/**
 * Marks a cell that another person has focused. It shows their initial in the
 * cell's top-right corner, in their presence colour. Hovering the initial shows
 * a tooltip with their email.
 *
 * The colour is the same one `DocumentPresence` uses for that person, so a
 * cell can be matched to a person without hovering. The cell's tint and the
 * bar along its left edge come from `Column` in `PublicationIndexTable`, not
 * from this component.
 */
const CellPresence: FC<{ colour: number; by: string }> = ({ colour, by }) => {
  const t = useTranslations("documents");
  const who = t("editingHere", { who: by });

  return (
    <Tooltip variant="info" message={who}>
      <span
        data-colour={colour}
        aria-label={who}
        className="
          flex absolute top-0 right-0 justify-center items-center px-1 h-4
          text-[10px] font-medium leading-none text-white rounded-bl
          bg-(--presence)
        "
      >
        {initial(by)}
      </span>
    </Tooltip>
  );
};

export default CellPresence;
