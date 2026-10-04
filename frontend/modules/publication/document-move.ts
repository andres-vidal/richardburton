import type { Store } from "modules/store";
import * as Y from "yjs";
import * as Doc from "./doc";
import { append, updates } from "./document-remote";
import type { PublicationId } from "./model";
import { moveOut, publicationFamily } from "./store";

/**
 * Moves the rows `ids` of the store's import document to the end of the import
 * document `target`.
 *
 * It reads `target`'s stored updates into a document of its own, adds the rows
 * there, and posts only what that changed, as one update. The server also
 * relays the update to the people who have `target` open, so the rows appear
 * for them without a reload. The rows keep their keys, so each is the same row
 * in its new document.
 *
 * The rows are removed from the store's document only after the post
 * succeeds. When reading or posting fails, it rejects and both documents are
 * left as they were.
 */
async function moveRows(
  store: Store,
  ids: PublicationId[],
  target: number,
): Promise<void> {
  const entries = ids.map((id) => ({
    id,
    publication: store.get(publicationFamily(id)),
  }));

  const doc = new Y.Doc();

  try {
    const held = await updates(target);
    held.updates.forEach((update) => Y.applyUpdate(doc, update));

    const before = Y.encodeStateVector(doc);
    Doc.appendRows(doc, entries);

    await append(
      target,
      Y.encodeStateAsUpdate(doc, before),
      Doc.rowCount(doc),
      { relay: true },
    );
  } finally {
    doc.destroy();
  }

  moveOut(store, ids);
}

export { moveRows };
