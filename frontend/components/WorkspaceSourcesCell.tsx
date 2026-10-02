"use client";

import WarningIcon from "assets/warning.svg";
import {
  usePublicationResemblance,
  usePublicationSources,
} from "modules/publication/hooks";
import { usePublicationStore } from "modules/publication/workspace";
import { openReview, setSources } from "modules/publication/store";
import { useTranslations } from "next-intl";
import { FC, MouseEvent, useState } from "react";
import Button from "./Button";
import { Modal } from "./Modal";
import type { RowId } from "./PublicationIndexTable";
import SourcesEditor from "./SourcesEditor";
import Tooltip from "./Tooltip";

/**
 * A "Look-alike" button for a row that resembles something. Pressing it opens
 * the resemblance review on this row. It renders nothing when the row resembles
 * nothing.
 *
 * Its tooltip and accessible name give the title and year of each stored record
 * the row resembles, and the number of other rows of the import it resembles.
 *
 * It is styled as a button so that it is not confused with the warning icon in
 * the row's leading cell. That icon only marks the row.
 *
 * It is at the end of the row, not in the leading cell, because the leading
 * cell is the row's selection handle and a button there would take clicks meant
 * to select the row.
 */
const RowResemblance: FC<{ rowId: RowId }> = ({ rowId }) => {
  const t = useTranslations("resemblances");
  const store = usePublicationStore();
  const resemblance = usePublicationResemblance(rowId);

  const named = (resemblance?.stored ?? []).map((publication) =>
    t("namedPublication", { title: publication.title, year: publication.year }),
  );

  const message = [
    named.length > 0 ? t("looksLikeNamed", { names: named.join("; ") }) : null,
    resemblance && resemblance.others.length > 0
      ? t("looksLikeRows", { count: resemblance.others.length })
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  return resemblance === null ? null : (
    <Tooltip variant="warning" message={message} placement="left">
      <Button
        variant="outline"
        width="fit"
        size="small"
        // Passed as an element, not a component, so it keeps its amber colour.
        // `Button` gives a component icon the colour of its variant.
        Icon={<WarningIcon className="size-4 text-amber-500" />}
        label={t("lookAlike")}
        aria-label={message}
        onClick={(event) => {
          // Stops the click here, because the row's click handler selects it.
          event.stopPropagation();
          openReview(store, rowId);
        }}
      />
    </Tooltip>
  );
};

/**
 * The trailing "sources" cell for a workspace row. Sources is a list, not a
 * scalar cell, so it lives outside the attribute grid: a button shows the count
 * and opens the list editor in a modal. Edits are written to the row with
 * `setSources`, and the bulk insert saves them with the rest of the row.
 *
 * The row-state props mirror the attribute cells so the cell shares the row's
 * hover / error / selected background. The workspace supplies them for committed
 * rows and leaves them at their defaults for the plain draft row.
 */
const WorkspaceSourcesCell: FC<{
  rowId: RowId;
  invalid?: boolean;
  selected?: boolean;
  focused?: boolean;
}> = ({ rowId, invalid = false, selected = false, focused = false }) => {
  const t = useTranslations("admin");
  const sources = usePublicationSources(rowId);
  const [open, setOpen] = useState(false);
  const count = sources.length;

  // The cell sits inside the row's onClick (which selects the row); opening the
  // editor must not also select.
  const store = usePublicationStore();

  const openEditor = (event: MouseEvent) => {
    event.stopPropagation();
    setOpen(true);
  };

  return (
    <div
      role="cell"
      data-selected={selected}
      data-error={invalid}
      data-focused={focused}
      className="flex gap-2 items-center py-1 px-2 transition-colors group-hover:bg-indigo-100 error:group-hover:bg-red-100 error:focused:bg-red-100 selected:bg-amber-100 selected:focused:error:bg-amber-100"
    >
      <Button
        variant="outline"
        width="fit"
        size="small"
        onClick={openEditor}
        aria-label={count === 0 ? t("addSources") : t("editSources", { count })}
        label={t("sourcesCount", { count })}
      />

      <RowResemblance rowId={rowId} />

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        label={t("sourcesEditor")}
      >
        <div className="p-8 space-y-4 w-full">
          <h1 className="text-xl font-normal">{t("sourcesEditor")}</h1>
          <SourcesEditor
            value={sources}
            onChange={(next) => setSources(store, rowId, next)}
          />
        </div>
      </Modal>
    </div>
  );
};

export default WorkspaceSourcesCell;
