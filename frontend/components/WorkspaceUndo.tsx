"use client";

import RestorePageIcon from "assets/restore-page.svg";
import HistoryIcon from "assets/history.svg";
import { useWorkspaceUndo } from "modules/publication/undo";
import { useVisiblePublicationCount } from "modules/publication/hooks";
import { useTranslations } from "next-intl";
import { FC } from "react";
import Button from "./Button";
import Tooltip from "./Tooltip";

/**
 * Walk back an edit, or put it back.
 *
 * Scoped to the person using it: a workspace is shared, so undoing your last
 * change must not undo what your collaborator just typed. A row's creation and
 * the typing that follows are separate steps, so one undo never takes away a
 * row someone meant only to retitle.
 */
const WorkspaceUndo: FC = () => {
  const t = useTranslations("admin");
  const { canUndo, canRedo, undo, redo } = useWorkspaceUndo();
  const publicationCount = useVisiblePublicationCount();

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
