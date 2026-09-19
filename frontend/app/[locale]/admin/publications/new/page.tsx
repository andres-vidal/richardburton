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
import ResetOverridden from "components/ResetOverridden";
import RowIdToggle from "components/RowIdToggle";
import { Publication } from "modules/publication/model";
import { setAll, setAttributesVisible } from "modules/publication/store";
import { PublicationStoreProvider } from "modules/publication/workspace";
import type { Store } from "modules/store";
import { useIsSelectionEmpty } from "modules/selection";

function startEmpty(store: Store) {
  setAll(store, []);
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
              <ResetOverridden />
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
    <PublicationStoreProvider initialize={startEmpty}>
      <NewPublications />
    </PublicationStoreProvider>
  );
}
