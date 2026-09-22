"use client";

import WarningIcon from "assets/warning.svg";
import {
  usePublicationResemblance,
  usePublicationSources,
} from "modules/publication/hooks";
import { usePublicationStore } from "modules/publication/workspace";
import { openReview, overrideSources } from "modules/publication/store";
import { useTranslations } from "next-intl";
import { FC, MouseEvent, useState } from "react";
import Button from "./Button";
import { Modal } from "./Modal";
import type { RowId } from "./PublicationIndexTable";
import SourcesEditor from "./SourcesEditor";
import Tooltip from "./Tooltip";

/**
 * What the row looks like, and the way into the comparison.
 *
 * It names the records rather than only reporting that there are some: a row
 * marked "this resembles something" without saying what leaves the reader to go
 * and find it. Pressing it opens the review on this row, where the records are
 * set out in full and can be followed through to.
 *
 * It sits at the end of the row rather than in the leading cell because that
 * cell is the row's selection handle, and a control there would take the clicks
 * meant for selecting.
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
    <Tooltip variant="warning" message={t("inspect")} placement="left">
      <button
        type="button"
        aria-label={message}
        className="flex items-center text-amber-500 hover:text-amber-600"
        onClick={(event) => {
          // The row around this selects when it is clicked, and asking to see a
          // look-alike is not asking to select anything.
          event.stopPropagation();
          openReview(store, rowId);
        }}
      >
        <WarningIcon className="w-5 aspect-square" />
      </button>
    </Tooltip>
  );
};

/**
 * The trailing "sources" cell for a workspace row. Sources is a list, not a
 * scalar cell, so it lives outside the attribute grid: a button shows the count
 * and opens the list editor in a modal. Edits write to the row's override overlay,
 * so they ride the bulk insert with everything else — no separate save.
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
            onChange={(next) => overrideSources(store, rowId, next)}
          />
        </div>
      </Modal>
    </div>
  );
};

export default WorkspaceSourcesCell;
