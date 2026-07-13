"use client";

import Layout from "components/Layout";
import PublicationCounter from "components/PublicationCounter";
import PublicationDelete from "components/PublicationDelete";
import PublicationDeselect from "components/PublicationDeselect";
import PublicationDuplicate from "components/PublicationDuplicate";
import PublicationErrorCounter from "components/PublicationErrorCounter";
import PublicationSubmit from "components/PublicationSubmit";
import PublicationUpload from "components/PublicationUpload";
import PublicationWorkspace from "components/PublicationWorkspace";
import ResetDeleted from "components/ResetDeleted";
import ResetOverridden from "components/ResetOverridden";
import RowIdToggle from "components/RowIdToggle";
import StrikeHeading from "components/StrikeHeading";
import { Publication } from "modules/publication/model";
import {
  resetAll,
  setAll,
  setAttributesVisible,
} from "modules/publication/store";
import { useEffect } from "react";
import { useIsSelectionEmpty } from "modules/selection";

export default function NewPublications() {
  const isSelectionEmpty = useIsSelectionEmpty();

  useEffect(() => setAll([]), []);
  useEffect(() => setAttributesVisible(Publication.ATTRIBUTES), []);
  useEffect(() => resetAll, []);

  return (
    <Layout
      subheader={
        <StrikeHeading label="Prepare new publications to be inserted in the database" />
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
