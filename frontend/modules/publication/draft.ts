import type { Store } from "modules/store";

import { empty, type Publication } from "./model";
import { DRAFT_ID, publicationFamily } from "./store";

/**
 * The `localStorage` key for a workspace's draft row.
 *
 * The draft row is kept in `localStorage` rather than in the document, because
 * it is one person's unfinished typing. It should survive a reload but not
 * reach anyone else sharing the workspace. The document would keep it across a
 * reload, but it would also share it.
 */
const key = (name: string) => `rb:draft:${name}`;

/** Returns whether any field of the draft other than `id` has a value. */
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
 * Restores the draft row from `localStorage`, then saves it there each time it
 * changes. When the draft is empty, the saved copy is removed. Returns a
 * function that stops saving.
 *
 * Every read and write catches errors, because storage is unavailable in a
 * private window and can be full. A draft row is not worth failing a page over.
 */
function keepDraft(store: Store, name: string): () => void {
  restore(store, name);

  return store.sub(publicationFamily(DRAFT_ID), () => {
    const draft = store.get(publicationFamily(DRAFT_ID));

    try {
      if (written(draft)) {
        localStorage.setItem(key(name), JSON.stringify(draft));
      } else {
        // The draft row was added or cleared, so there is nothing to restore.
        localStorage.removeItem(key(name));
      }
    } catch {
      // Without storage, the draft is kept only in memory for this tab.
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
    // The saved value could not be read or parsed, so the draft starts empty.
  }
}

export { keepDraft };
