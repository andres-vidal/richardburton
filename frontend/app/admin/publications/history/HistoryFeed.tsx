"use client";

import PublicationHistoryFeed from "components/PublicationHistoryFeed";
import type { WithChanges } from "modules/publication/history";
import type { FullHistoryEntry } from "modules/publication/model";
import { undo } from "modules/publication/remote";
import { useRouter } from "next/navigation";
import { FC } from "react";

/**
 * The interactive half of the history page: the page itself is a server
 * component and reads the log, so all that has to run in the browser is
 * dispatching an undo and asking the server for the log again.
 *
 * `router.refresh()` rather than a re-fetch — the server render is the source
 * of the data now, so re-running it is how the feed learns what the undo
 * changed, including which *other* entries stopped being undoable.
 */
const HistoryFeed: FC<{ entries: WithChanges<FullHistoryEntry>[] }> = ({
  entries,
}) => {
  const router = useRouter();

  async function handleUndo(entry: FullHistoryEntry) {
    if (await undo(entry.publicationId, entry.version)) router.refresh();
  }

  return <PublicationHistoryFeed entries={entries} onUndo={handleUndo} />;
};

export default HistoryFeed;
