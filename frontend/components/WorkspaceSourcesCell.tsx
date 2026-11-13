"use client";

import WarningIcon from "assets/warning.svg";
import {
  usePublicationFieldError,
  usePublicationResemblance,
  usePublicationSources,
} from "modules/publication/hooks";
import { shownSources, type Language } from "modules/publication/model";
import { usePublicationStore } from "modules/publication/workspace";
import { openReview, setSources } from "modules/publication/store";
import { useLocale, useTranslations } from "next-intl";
import { FC, MouseEvent } from "react";
import Button from "./Button";
import { Modal, useModal } from "./Modal";
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
 * the row's leading cell. That icon only marks the row. The icon is passed to
 * `Button` as an element rather than a component, so it keeps its amber colour
 * instead of taking the colour of the button's variant.
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
 * The cell at the end of a workspace row: a button with the row's source
 * count, which opens the sources editor in a dialog, and the row's look-alike
 * button. The count is that of the sources in the reader's language, or in the
 * other language when there are none in the reader's (see `shownSources`).
 * Sources are lists rather than one value, so they are edited outside the
 * attribute grid. Edits are written to the row with `setSources`, and the bulk
 * insert saves them with the rest of the row. A click on either button does
 * not reach the row, so it does not select the row.
 *
 * When the sources in either language have an error, the button's tooltip
 * gives it, or the Portuguese one when both languages have one, and the editor
 * shows each error under its language's list.
 *
 * `invalid`, `selected` and `focused` give the cell the background the
 * row's other cells have in those states. They default to false.
 */
const WorkspaceSourcesCell: FC<{
  rowId: RowId;
  invalid?: boolean;
  selected?: boolean;
  focused?: boolean;
}> = ({ rowId, invalid = false, selected = false, focused = false }) => {
  const t = useTranslations("admin");
  const locale = useLocale() as Language;
  const store = usePublicationStore();
  const sources = usePublicationSources(rowId);
  const errors = {
    pt: usePublicationFieldError(rowId, "sourcesPt"),
    en: usePublicationFieldError(rowId, "sourcesEn"),
  };
  const error = errors.pt || errors.en;
  const editor = useModal();
  const count =
    shownSources({ sourcesPt: sources.pt, sourcesEn: sources.en }, locale)
      ?.sources.length ?? 0;

  const openEditor = (event: MouseEvent) => {
    event.stopPropagation();
    editor.open();
  };

  return (
    <div
      role="cell"
      data-selected={selected}
      data-error={invalid}
      data-focused={focused}
      className="flex gap-2 items-center py-1 px-2 transition-colors group-hover:bg-indigo-100 error:group-hover:bg-red-100 error:focused:bg-red-100 selected:bg-amber-100 selected:focused:error:bg-amber-100"
    >
      <Tooltip variant="error" message={error} placement="left">
        <Button
          variant="outline"
          width="fit"
          size="small"
          onClick={openEditor}
          aria-label={
            count === 0 ? t("addSources") : t("editSources", { count })
          }
          label={t("sourcesCount", { count })}
        />
      </Tooltip>

      <RowResemblance rowId={rowId} />

      <Modal
        isOpen={editor.isOpen}
        onClose={editor.close}
        heading={t("sourcesEditor")}
      >
        <SourcesEditor
          value={sources}
          errors={errors}
          onChange={(language, next) =>
            setSources(store, rowId, language, next)
          }
        />
      </Modal>
    </div>
  );
};

export default WorkspaceSourcesCell;
