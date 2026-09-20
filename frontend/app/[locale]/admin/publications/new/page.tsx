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
import WorkspaceUndo from "components/WorkspaceUndo";
import RowIdToggle from "components/RowIdToggle";
import { Publication } from "modules/publication/model";
import { setAttributesVisible } from "modules/publication/store";
import { PublicationStoreProvider } from "modules/publication/workspace";
import { WorkspaceDocument } from "modules/publication/workspace-document";
import type { Store } from "modules/store";
import { useIsSelectionEmpty } from "modules/selection";

// Which columns are on screen is this person’s own, not part of the content,
// so it is set here rather than restored with the rows.
function showEveryColumn(store: Store) {
  setAttributesVisible(store, Publication.ATTRIBUTES);
}

function NewPublications() {
  const t = useTranslations("admin");
  const isSelectionEmpty = useIsSelectionEmpty();

  const crumbs = [
    { label: t("home"), href: "/" },
    { label: t("admin"), href: "/admin" },
    { label: t("newTitle") },
  ];

  return (
    <Layout
      subheader={
        <>
          <Breadcrumb items={crumbs} />
          <PageHeader title={t("newTitle")} description={t("newPage")} />
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
}

export default function NewPublicationsPage() {
  return (
    <PublicationStoreProvider initialize={showEveryColumn}>
      <WorkspaceDocument>
        <NewPublications />
      </WorkspaceDocument>
    </PublicationStoreProvider>
  );
}
