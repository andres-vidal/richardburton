"use client";

import { initial } from "modules/publication/presence";
import { useTranslations } from "next-intl";
import { FC } from "react";
import Tooltip from "./Tooltip";

/**
 * Somebody else's cursor, in the cell they have it in.
 *
 * Two things are shown, because a colour alone says that *somebody* is there
 * without saying who: a bar where the cursor sits, and the initial of whoever
 * it belongs to. Hovering either names them.
 *
 * The colour is theirs throughout — the same one their initial carries at the
 * top of the document — so a cell can be traced back to a person without
 * hovering at all.
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
