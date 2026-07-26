"use client";

import Breadcrumb from "components/Breadcrumb";
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
import { usePublicationStore } from "modules/publication/workspace";
import {
  resetAll,
  setAll,
  setAttributesVisible,
} from "modules/publication/store";
import ClearSelection from "listeners/ClearSelection";
import { PublicationStoreProvider } from "modules/publication/workspace";
import { useIsSelectionEmpty } from "modules/selection";
import { useEffect } from "react";

const BREADCRUMB_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Admin", href: "/admin" },
  { label: "Add publications" },
];

function NewPublications() {
  const store = usePublicationStore();
  const isSelectionEmpty = useIsSelectionEmpty();

  useEffect(() => setAll(store, []), [store]);
  useEffect(() => setAttributesVisible(store, Publication.ATTRIBUTES), [store]);
  useEffect(() => () => resetAll(store), [store]);

  return (
    <Layout
      subheader={
        <>
          <Breadcrumb items={BREADCRUMB_ITEMS} />
          <PageHeader
            title="Add publications"
            description="Prepare new publications to be inserted in the database."
          />
        </>
      }
      content={
        <>
          <ClearSelection store={store} />
          <PublicationWorkspace />
        </>
      }
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
    <PublicationStoreProvider>
      <NewPublications />
    </PublicationStoreProvider>
  );
}
