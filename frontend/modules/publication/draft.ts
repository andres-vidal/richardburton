import type { Store } from "modules/store";

import { empty, type Publication } from "./model";
import { DRAFT_ID, publicationFamily, visiblePublicationFamily } from "./store";

/**
 * Where the unfinished row is kept, per workspace.
 *
 * Browser storage rather than the document, because the draft row is one
 * person's unfinished typing: it should survive their reload without reaching
 * anyone else sharing the workspace. Those are different requirements, and the
 * document only answers the second.
 */
const key = (name: string) => `rb:draft:${name}`;

/** Whether the draft holds anything worth keeping. */
function written(draft: Publication): boolean {
  return Object.entries(draft).some(([field, value]) =>
    field === "id"
      ? false
      : Array.isArray(value)
        ? value.length > 0
        : Boolean(value),
  );
}

/**
 * Keep the draft row across reloads, and put back what was left in it.
 *
 * Every read and write is guarded: storage is unavailable in a private window
 * and can be full, and a draft row is not worth failing a page over.
 *
 * Returns the way to stop.
 */
function keepDraft(store: Store, name: string): () => void {
  restore(store, name);

  // What the row shows, wherever it is held: a workspace writes the draft
  // straight to the row, and a surface without a document layers it over one.
  return store.sub(visiblePublicationFamily(DRAFT_ID), () => {
    const draft = store.get(visiblePublicationFamily(DRAFT_ID));

    try {
      if (written(draft)) {
        localStorage.setItem(key(name), JSON.stringify(draft));
      } else {
        // Added or cleared: there is nothing left to come back to.
        localStorage.removeItem(key(name));
      }
    } catch {
      // No storage, so the draft lives as long as the tab does.
    }
  });
}

function restore(store: Store, name: string): void {
  try {
    const held = localStorage.getItem(key(name));
    if (!held) return;

    store.set(publicationFamily(DRAFT_ID), {
      ...empty(),
      ...(JSON.parse(held) as Partial<Publication>),
    });
  } catch {
    // Unreadable or not the shape it was written in; the draft starts empty.
  }
}

export { keepDraft };
