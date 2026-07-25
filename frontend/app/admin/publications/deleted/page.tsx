"use client";

import Breadcrumb from "components/Breadcrumb";
import DeletedPublications from "components/DeletedPublications";
import Layout from "components/Layout";
import PageHeader from "components/PageHeader";
import type {
  DeletedPublicationEntry,
  PublicationId,
} from "modules/publication/model";
import { deleted, restore } from "modules/publication/remote";
import { useEffect, useState } from "react";

const BREADCRUMB_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Admin", href: "/admin" },
  { label: "Deleted publications" },
];

export default function DeletedPublicationsPage() {
  const [entries, setEntries] = useState<DeletedPublicationEntry[]>();

  useEffect(() => {
    // `run` already surfaces a notification on failure.
    deleted()
      .then(setEntries)
      .catch(() => {});
  }, []);

  // Which row is spinning is the list's own state; this only does the work and
  // drops the row on success. A failed restore — the record was imported again
  // while it sat here — leaves the list alone, and `run` has already said so.
  async function handleRestore(id: PublicationId) {
    if (await restore(id)) {
      setEntries((current) =>
        current?.filter(({ publication }) => publication.id !== id),
      );
    }
  }

  return (
    <Layout
      subheader={
        <>
          <Breadcrumb items={BREADCRUMB_ITEMS} />
          <PageHeader
            title="Deleted publications"
            description="Records removed from the catalogue. Restoring brings one back exactly as it was."
          />
        </>
      }
      measure="centered"
      content={
        entries === undefined ? (
          <p className="text-sm text-gray-600">Loading…</p>
        ) : (
          <DeletedPublications entries={entries} onRestore={handleRestore} />
        )
      }
    />
  );
}
