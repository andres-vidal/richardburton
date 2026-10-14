"use client";

import { plainText } from "modules/comments";
import {
  usePublicationComments,
  usePublicationCommentsError,
} from "modules/publication/hooks";
import { setComments } from "modules/publication/store";
import { usePublicationStore } from "modules/publication/workspace";
import { useTranslations } from "next-intl";
import { FC, MouseEvent } from "react";
import { BUTTON_CLASS_NAME } from "./Button";
import CommentsEditor from "./CommentsEditor";
import { Modal, useModal } from "./Modal";
import type { RowId } from "./PublicationIndexTable";
import Tooltip from "./Tooltip";

/**
 * The cell of a workspace row that holds the row's comments: a button showing
 * them as one line of plain text, cut short to fit, which opens the comments
 * editor in a dialog. A row without comments shows "Comments" instead. Edits
 * are written to the row with `setComments`, and the bulk insert saves them
 * with the rest of the row. A click on the button does not reach the row, so it
 * does not select the row.
 *
 * When the comments have an error, such as being too long, the button's
 * tooltip says so, and the editor shows it under the text.
 *
 * `invalid`, `selected` and `focused` give the cell the background the row's
 * other cells have in those states. They default to false.
 */
const WorkspaceCommentsCell: FC<{
  rowId: RowId;
  invalid?: boolean;
  selected?: boolean;
  focused?: boolean;
}> = ({ rowId, invalid = false, selected = false, focused = false }) => {
  const t = useTranslations("admin");
  const store = usePublicationStore();
  const comments = usePublicationComments(rowId);
  const error = usePublicationCommentsError(rowId);
  const editor = useModal();
  const preview = plainText(comments);

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
          aria-label={
            preview ? t("editComments", { preview }) : t("addComments")
          }
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
            {preview || t("noCommentsPreview")}
          </span>
        </button>
      </Tooltip>

      <Modal
        isOpen={editor.isOpen}
        onClose={editor.close}
        heading={t("commentsEditor")}
      >
        <CommentsEditor
          value={comments}
          error={error}
          onChange={(markdown) => setComments(store, rowId, markdown)}
        />
      </Modal>
    </div>
  );
};

export default WorkspaceCommentsCell;
