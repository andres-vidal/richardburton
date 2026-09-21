"use client";

import Breadcrumb from "components/Breadcrumb";
import { useTranslations } from "next-intl";
import Layout from "components/Layout";
import PageHeader from "components/PageHeader";
import PublicationCounter from "components/PublicationCounter";
import PublicationDiscard from "components/PublicationDiscard";
import PublicationDeselect from "components/PublicationDeselect";
import PublicationDuplicate from "components/PublicationDuplicate";
import PublicationErrorCounter from "components/PublicationErrorCounter";
import PublicationSubmit from "components/PublicationSubmit";
import PublicationUpload from "components/PublicationUpload";
import PublicationWorkspace from "components/PublicationWorkspace";
import ResetDiscarded from "components/ResetDiscarded";
import WorkspaceShare from "components/WorkspaceShare";
import WorkspaceUndo from "components/WorkspaceUndo";
import RowIdToggle from "components/RowIdToggle";
import { Publication } from "modules/publication/model";
import { setAttributesVisible } from "modules/publication/store";
import { PublicationStoreProvider } from "modules/publication/workspace";
import { WorkspaceDocument } from "modules/publication/workspace-document";
import type { Store } from "modules/store";
import { useIsSelectionEmpty } from "modules/selection";
import { FC } from "react";

// Which columns are on screen is this person’s own, not part of the content,
// so it is set here rather than restored with the rows.
function showEveryColumn(store: Store) {
  setAttributesVisible(store, Publication.ATTRIBUTES);
}

const Workspace: FC<{ title: string; description: string }> = ({
  title,
  description,
}) => {
  const t = useTranslations("admin");
  const isSelectionEmpty = useIsSelectionEmpty();

  const crumbs = [
    { label: t("home"), href: "/" },
    { label: t("admin"), href: "/admin" },
    { label: title },
  ];

  return (
    <Layout
      subheader={
        <>
          <Breadcrumb items={crumbs} />
          <PageHeader title={title} description={description} />
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
              <WorkspaceUndo />
              <ResetDiscarded />
              <RowIdToggle />
              <WorkspaceShare />
              <PublicationSubmit />
            </>
          ) : (
            <>
              <PublicationDeselect />
              <PublicationDuplicate />
              <PublicationDiscard />
            </>
          )}
        </div>
      }
    />
  );
};

/**
 * Rows being prepared for the database, and everything done to them.
 *
 * The same surface whether the work is this browser's alone or a workspace the
 * server holds — only where the document lives differs, which is
 * `WorkspaceDocument`'s business rather than any of these components'.
 */
const BulkWorkspace: FC<{
  title: string;
  description: string;
  /** The workspace on the server, where there is one. */
  workspace?: number;
}> = ({ title, description, workspace }) => (
  <PublicationStoreProvider initialize={showEveryColumn}>
    <WorkspaceDocument workspace={workspace}>
      <Workspace title={title} description={description} />
    </WorkspaceDocument>
  </PublicationStoreProvider>
);

export default BulkWorkspace;
