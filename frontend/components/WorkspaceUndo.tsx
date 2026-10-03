"use client";

import RestorePageIcon from "assets/restore-page.svg";
import HistoryIcon from "assets/history.svg";
import { useWorkspaceUndo } from "modules/publication/undo";
import { useTotalPublicationCount } from "modules/publication/hooks";
import { useTranslations } from "next-intl";
import { FC } from "react";
import Button from "./Button";
import Tooltip from "./Tooltip";

/**
 * Undo and Redo buttons for the workspace.
 *
 * They undo only the changes made in this tab, and leave changes made by other
 * people in the same document alone. Adding a row and typing into it are
 * separate undo steps, so undoing the typing does not remove the row.
 *
 * Renders nothing when the workspace has no rows or there is nothing to undo or
 * redo. Discarded rows count as rows, so a workspace whose rows are all
 * discarded still offers the undo that brings them back. The Redo button
 * appears only when there is something to redo.
 */
const WorkspaceUndo: FC = () => {
  const t = useTranslations("admin");
  const { canUndo, canRedo, undo, redo } = useWorkspaceUndo();
  const publicationCount = useTotalPublicationCount();

  return publicationCount === 0 || (!canUndo && !canRedo) ? null : (
    <div className="flex gap-1">
      <Tooltip variant="info" message={t("undoHint")}>
        <Button
          label={t("undo")}
          variant="outline"
          Icon={RestorePageIcon}
          alignment="left"
          width="fit"
          disabled={!canUndo}
          onClick={undo}
        />
      </Tooltip>
      {canRedo && (
        <Tooltip variant="info" message={t("redoHint")}>
          <Button
            label={t("redo")}
            variant="outline"
            Icon={HistoryIcon}
            alignment="left"
            width="fit"
            onClick={redo}
          />
        </Tooltip>
      )}
    </div>
  );
};

export default WorkspaceUndo;
