"use client";

import Breadcrumb from "components/Breadcrumb";
import Layout from "components/Layout";
import PageHeader from "components/PageHeader";
import PublicationHistoryFeed from "components/PublicationHistoryFeed";
import type { WithChanges } from "modules/publication/history";
import type { FullHistoryEntry } from "modules/publication/model";
import { fullHistory, undo } from "modules/publication/remote";
import { useEffect, useState } from "react";

const BREADCRUMB_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Admin", href: "/admin" },
  { label: "History" },
];

export default function PublicationHistoryPage() {
  const [entries, setEntries] = useState<WithChanges<FullHistoryEntry>[]>();

  useEffect(() => {
    // `run` already surfaces a notification on failure.
    fullHistory()
      .then(setEntries)
      .catch(() => {});
  }, []);

  // Name the entry and let the server work out which action compensates it.
  // On success reload the feed: the undo is itself a new entry, and it may have
  // changed what else is still undoable. Awaited, not fired and forgotten — the
  // feed keeps the row spinning until this resolves, so the button never goes
  // idle over a stale list.
  async function handleUndo(entry: FullHistoryEntry) {
    if (await undo(entry.publicationId, entry.version)) {
      await fullHistory()
        .then(setEntries)
        .catch(() => {});
    }
  }

  return (
    <Layout
      subheader={
        <>
          <Breadcrumb items={BREADCRUMB_ITEMS} />
          <PageHeader
            title="History"
            description="Every change to the catalogue — who did what, and when. Any change still reconcilable with the current state can be undone."
          />
        </>
      }
      measure="centered"
      content={
        entries === undefined ? (
          <p className="text-sm text-gray-600">Loading…</p>
        ) : (
          <PublicationHistoryFeed entries={entries} onUndo={handleUndo} />
        )
      }
    />
  );
}
