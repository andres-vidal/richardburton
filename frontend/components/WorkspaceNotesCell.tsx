"use client";

import { plainText } from "modules/rich-text";
import {
  usePublicationFieldError,
  usePublicationNotes,
} from "modules/publication/hooks";
import { shownNotes, type Language } from "modules/publication/model";
import { useLocale, useTranslations } from "next-intl";
import { FC, MouseEvent } from "react";
import { BUTTON_CLASS_NAME } from "./Button";
import { Modal, useModal } from "./Modal";
import NotesField from "./NotesField";
import type { RowId } from "./PublicationIndexTable";
import Tooltip from "./Tooltip";

/**
 * The cell of a workspace row that holds the row's notes: a button showing
 * them as one line of plain text, cut short to fit, which opens the row's
 * `NotesField` in a dialog. The button shows the notes in the reader's
 * language, or in the other language when the row has none in the reader's
 * (see `shownNotes`). A row without notes shows "Notes" instead. The field
 * writes edits to the row, and the bulk insert saves them with the rest of the
 * row. A click on the button does not reach the row, so it does not select the
 * row.
 *
 * When the notes in either language have an error, such as being too long, the
 * button's tooltip says so, and the field shows it under the text.
 *
 * `invalid`, `selected` and `focused` give the cell the background the row's
 * other cells have in those states. They default to false.
 */
const WorkspaceNotesCell: FC<{
  rowId: RowId;
  invalid?: boolean;
  selected?: boolean;
  focused?: boolean;
}> = ({ rowId, invalid = false, selected = false, focused = false }) => {
  const t = useTranslations("admin");
  const locale = useLocale() as Language;
  const notes = usePublicationNotes(rowId);
  const errorPt = usePublicationFieldError(rowId, "notesPt");
  const errorEn = usePublicationFieldError(rowId, "notesEn");
  const error = errorPt || errorEn;
  const editor = useModal();
  const preview = plainText(
    shownNotes({ notesPt: notes.pt, notesEn: notes.en }, locale)?.value,
  );

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
      className="flex items-center py-1 px-2 transition-colors group-hover:bg-indigo-100 error:group-hover:bg-red-100 error:focused:bg-red-100 selected:bg-amber-100 selected:focused:error:bg-amber-100"
    >
      <Tooltip variant="error" message={error} placement="left">
        <button
          type="button"
          onClick={openEditor}
          aria-label={preview ? t("editNotes", { preview }) : t("addNotes")}
          data-variant="outline"
          data-size="small"
          data-width="fit"
          data-alignment="center"
          className={BUTTON_CLASS_NAME}
        >
          <span
            data-empty={preview === ""}
            className="max-w-48 truncate data-[empty=true]:text-gray-500"
          >
            {preview || t("noNotesPreview")}
          </span>
        </button>
      </Tooltip>

      <Modal
        isOpen={editor.isOpen}
        onClose={editor.close}
        heading={t("notesEditor")}
      >
        <NotesField id={rowId} />
      </Modal>
    </div>
  );
};

export default WorkspaceNotesCell;
