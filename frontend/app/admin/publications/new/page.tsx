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
import type { Store } from "modules/store";
import { useIsSelectionEmpty } from "modules/selection";
import { useEffect } from "react";

const BREADCRUMB_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Admin", href: "/admin" },
  { label: "Add publications" },
];

/**
 * How this workspace starts: an empty working set — so the draft row is there to
 * type into rather than a loading skeleton — with every column shown, since a
 * contributor is filling all of them.
 */
function startEmpty(store: Store) {
  setAll(store, []);
  setAttributesVisible(store, Publication.ATTRIBUTES);
}

function NewPublications() {
  const store = usePublicationStore();
  const isSelectionEmpty = useIsSelectionEmpty();

  // The store goes with this page, but the atom *caches* are module-level and
  // outlive it — so drop what this workspace put in them on the way out.
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
    <PublicationStoreProvider initialize={startEmpty}>
      <NewPublications />
    </PublicationStoreProvider>
  );
}
