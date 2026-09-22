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
import PublicationResemblanceCounter from "components/PublicationResemblanceCounter";
import PublicationSubmit from "components/PublicationSubmit";
import PublicationUpload from "components/PublicationUpload";
import PublicationWorkspace from "components/PublicationWorkspace";
import ResetDiscarded from "components/ResetDiscarded";
import DocumentPresence from "components/DocumentPresence";
import WorkspaceUndo from "components/WorkspaceUndo";
import RowIdToggle from "components/RowIdToggle";
import { Publication } from "modules/publication/model";
import { setAttributesVisible } from "modules/publication/store";
import { PublicationStoreProvider } from "modules/publication/workspace";
import { DocumentProvider } from "modules/publication/document-provider";
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
          <div className="flex gap-4 justify-between items-center">
            <PageHeader title={title} description={description} />
            <DocumentPresence />
          </div>
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
              <PublicationResemblanceCounter />
              <WorkspaceUndo />
              <ResetDiscarded />
              <RowIdToggle />
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
 * Where the rows live is `DocumentProvider`'s business rather than any of these
 * components': they read atoms, as they did before any of this was shared.
 */
const BulkWorkspace: FC<{
  title: string;
  description: string;
  /** The import document these rows belong to. */
  document: number;
}> = ({ title, description, document }) => (
  <PublicationStoreProvider initialize={showEveryColumn}>
    <DocumentProvider document={document}>
      <Workspace title={title} description={description} />
    </DocumentProvider>
  </PublicationStoreProvider>
);

export default BulkWorkspace;
