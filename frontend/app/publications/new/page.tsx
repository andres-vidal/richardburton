"use client";

import PublicationReview from "components/PublicationReview";
import { Publication } from "modules/publication";

import Layout from "components/Layout";
import PublicationCounter from "components/PublicationCounter";
import PublicationDelete from "components/PublicationDelete";
import PublicationDeselect from "components/PublicationDeselect";
import PublicationDuplicate from "components/PublicationDuplicate";
import PublicationErrorCounter from "components/PublicationErrorCounter";
import PublicationSubmit from "components/PublicationSubmit";
import PublicationUpload from "components/PublicationUpload";
import ResetDeleted from "components/ResetDeleted";
import ResetOverridden from "components/ResetOverridden";
import RowIdToggle from "components/RowIdToggle";
import StrikeHeading from "components/StrikeHeading";
import { useEffect } from "react";
import { useIsSelectionEmpty } from "react-selection-manager";

export default function NewPublications() {
  const setAll = Publication.STORE.useSetAll();
  const setVisible = Publication.STORE.ATTRIBUTES.useSetVisible();
  const resetAll = Publication.STORE.useResetAll();
  const isSelectionEmpty = useIsSelectionEmpty();

  useEffect(() => setAll([]), [setAll]);
  useEffect(() => setVisible(Publication.ATTRIBUTES), [setVisible, setAll]);
  useEffect(() => resetAll, [resetAll]);

  return (
    <Layout
      subheader={
        <StrikeHeading label="Prepare new publications to be inserted in the database" />
      }
      content={<PublicationReview />}
      footer={
        <div className="flex space-x-2">
          {isSelectionEmpty ? (
            <>
              <PublicationUpload />
              <PublicationCounter />
              <PublicationErrorCounter />
              <ResetOverridden />
              <ResetDeleted />
              <RowIdToggle />
              <PublicationSubmit />
            </>
          ) : (
            <>
              <PublicationDeselect />
              <PublicationDuplicate />
              <PublicationDelete />
            </>
          )}
        </div>
      }
    />
  );
}
