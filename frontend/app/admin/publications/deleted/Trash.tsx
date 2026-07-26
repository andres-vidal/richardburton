"use client";

import DeletedPublications from "components/DeletedPublications";
import type {
  DeletedPublicationEntry,
  PublicationId,
} from "modules/publication/model";
import { restore } from "modules/publication/remote";
import { useRouter } from "next/navigation";
import { FC } from "react";

/**
 * The interactive half of the trash: the page reads what is currently deleted
 * on the server, so the browser only has to dispatch a restore and ask for the
 * list again.
 *
 * `router.refresh()` rather than dropping the row locally — a failed restore
 * (the record was imported again while it sat here) must leave the list exactly
 * as it was, and re-reading is the only account of that which cannot drift.
 */
const Trash: FC<{ entries: DeletedPublicationEntry[] }> = ({ entries }) => {
  const router = useRouter();

  async function handleRestore(id: PublicationId) {
    if (await restore(id)) router.refresh();
  }

  return <DeletedPublications entries={entries} onRestore={handleRestore} />;
};

export default Trash;
