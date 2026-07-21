"use client";

import { usePublicationReferences } from "modules/publication/hooks";
import { overrideReferences } from "modules/publication/store";
import { FC, MouseEvent, useState } from "react";
import Button from "./Button";
import { Modal } from "./Modal";
import type { RowId } from "./PublicationIndexTable";
import ReferencesEditor from "./ReferencesEditor";

/**
 * The trailing "sources" cell for a workspace row. References is a list, not a
 * scalar cell, so it lives outside the attribute grid: a button shows the count
 * and opens the list editor in a modal. Edits write to the row's override overlay,
 * so they ride the bulk insert with everything else — no separate save.
 *
 * The row-state props mirror the attribute cells so the cell shares the row's
 * hover / error / selected background. The workspace supplies them for committed
 * rows and leaves them at their defaults for the plain draft row.
 */
const WorkspaceReferencesCell: FC<{
  rowId: RowId;
  invalid?: boolean;
  selected?: boolean;
  focused?: boolean;
}> = ({ rowId, invalid = false, selected = false, focused = false }) => {
  const references = usePublicationReferences(rowId);
  const [open, setOpen] = useState(false);
  const count = references.length;

  // The cell sits inside the row's onClick (which selects the row); opening the
  // editor must not also select.
  const openEditor = (event: MouseEvent) => {
    event.stopPropagation();
    setOpen(true);
  };

  return (
    <div
      role="cell"
      data-selected={selected}
      data-selectable
      data-error={invalid}
      data-focused={focused}
      className="flex py-1 px-2 transition-colors group-hover:bg-indigo-100 error:group-hover:bg-red-100 error:focused:bg-red-100 selected:bg-amber-100 selected:focused:error:bg-amber-100"
    >
      <Button
        variant="outline"
        width="fit"
        size="small"
        onClick={openEditor}
        aria-label={
          count === 0 ? "Add references" : `Edit references (${count})`
        }
        label={
          count === 0 ? "Sources" : `${count} source${count === 1 ? "" : "s"}`
        }
      />

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        label="Edit references"
      >
        <div className="p-8 space-y-4 w-full">
          <h1 className="text-xl font-normal">References</h1>
          <ReferencesEditor
            value={references}
            onChange={(next) => overrideReferences(rowId, next)}
          />
        </div>
      </Modal>
    </div>
  );
};

export default WorkspaceReferencesCell;
