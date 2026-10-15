"use client";

import AdminPage from "components/AdminPage";
import PublicationCounter from "components/PublicationCounter";
import PublicationDeselect from "components/PublicationDeselect";
import PublicationDuplicate from "components/PublicationDuplicate";
import PublicationErrorCounter from "components/PublicationErrorCounter";
import PublicationMove from "components/PublicationMove";
import PublicationRemove from "components/PublicationRemove";
import PublicationResemblanceCounter from "components/PublicationResemblanceCounter";
import PublicationSubmit from "components/PublicationSubmit";
import PublicationUpload from "components/PublicationUpload";
import PublicationWorkspace from "components/PublicationWorkspace";
import DocumentPresence from "components/DocumentPresence";
import DocumentStatus from "components/DocumentStatus";
import WorkspaceUndo from "components/WorkspaceUndo";
import RowIdToggle from "components/RowIdToggle";
import WorkspaceNames from "components/WorkspaceNames";
import { Publication } from "modules/publication/model";
import { setAttributesVisible } from "modules/publication/store";
import { PublicationStoreProvider } from "modules/publication/workspace";
import { useUndoShortcuts, useWorkspaceUndo } from "modules/publication/undo";
import { DocumentProvider } from "modules/publication/document-provider";
import type { Store } from "modules/store";
import { useIsSelectionEmpty } from "modules/selection";
import { FC } from "react";

// Makes every attribute column visible when the store is created. Column
// visibility is local to each person and is not stored in the import document,
// so it is not loaded with the rows.
function showEveryColumn(store: Store) {
  setAttributesVisible(store, Publication.ATTRIBUTES);
}

// Renders the workspace in an `AdminPage`, with the document's status and
// presence beside the heading. The footer has the actions on the whole document
// while no row is selected, and the actions on the selected rows otherwise,
// followed by `PublicationMove` in both cases. The undo shortcuts are bound
// while it is mounted.
const Workspace: FC<{
  title: string;
  description: string;
  /** The import document these rows belong to. */
  document: number;
}> = ({ title, description, document }) => {
  const isSelectionEmpty = useIsSelectionEmpty();
  useUndoShortcuts(useWorkspaceUndo());

  return (
    <AdminPage
      title={title}
      description={description}
      aside={
        <>
          <DocumentStatus />
          <DocumentPresence />
        </>
      }
      content={<PublicationWorkspace />}
      footer={
        <div className="flex space-x-2">
          {isSelectionEmpty ? (
            <>
              <PublicationUpload />
              <PublicationCounter />
              <PublicationErrorCounter />
              <WorkspaceNames />
              <PublicationResemblanceCounter />
              <WorkspaceUndo />
              <RowIdToggle />
              <PublicationSubmit />
            </>
          ) : (
            <>
              <PublicationDeselect />
              <PublicationDuplicate />
              <PublicationRemove />
            </>
          )}
          <PublicationMove document={document} />
        </div>
      }
    />
  );
};

/**
 * The page for editing one import document: the publication workspace, the
 * document's status and presence in the header, and the row actions in the
 * footer.
 *
 * `DocumentProvider` connects the workspace store to the import document. The
 * components inside read and write rows through the store's atoms, not through
 * the document.
 */
const BulkWorkspace: FC<{
  title: string;
  description: string;
  /** The import document these rows belong to. */
  document: number;
}> = ({ title, description, document }) => (
  <PublicationStoreProvider initialize={showEveryColumn}>
    <DocumentProvider document={document}>
      <Workspace title={title} description={description} document={document} />
    </DocumentProvider>
  </PublicationStoreProvider>
);

export default BulkWorkspace;
