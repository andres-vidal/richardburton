"use client";

import type { WithChanges } from "modules/publication/history";
import { keyOf } from "modules/publication/history";
import type {
  FullHistoryEntry,
  PublicationHistoryAction,
} from "modules/publication/model";
import { FC, useState } from "react";
import { Entry, UNDO_DISABLED } from "./PublicationHistory";

type FeedEntry = WithChanges<FullHistoryEntry>;

const ACTIONS: PublicationHistoryAction[] = [
  "created",
  "updated",
  "deleted",
  "restored",
];

type Filter = { actions: PublicationHistoryAction[]; query: string };

/**
 * Every recorded change across the catalogue, newest first, each entry naming
 * its publication. Entries arrive with their changes already resolved — the
 * server diffs each version against its own record's previous one, never the
 * feed's previous row — so filters cannot affect what a diff says: they only
 * narrow what is *shown*.
 *
 * Every entry the server marks `undoable` carries **Undo**, and it decides both
 * the rule and the compensating action — this feed only names the entry. Being
 * a server rule rather than a drawing rule, it holds whoever asks. Deletion is
 * soft and the log only grows, so every undo is itself undoable from here — no
 * confirmation gates.
 *
 * The filters are view state, not navigation: what is *currently* deleted is
 * its own page, since a log of deletion events is a different question from
 * the set of records presently in the trash.
 */
const PublicationHistoryFeed: FC<{
  entries: FeedEntry[];
  /** Dispatches the compensating action; resolve when the feed is settled. */
  onUndo: (entry: FeedEntry) => Promise<void>;
}> = ({ entries, onUndo }) => {
  const [filter, setFilter] = useState<Filter>({ actions: [], query: "" });
  const [undoing, setUndoing] = useState(false);

  async function handleUndo(entry: FeedEntry) {
    setUndoing(true);
    try {
      await onUndo(entry);
    } finally {
      setUndoing(false);
    }
  }

  function toggleAction(action: PublicationHistoryAction) {
    setFilter((current) => ({
      ...current,
      actions: current.actions.includes(action)
        ? current.actions.filter((a) => a !== action)
        : [...current.actions, action],
    }));
  }

  const query = filter.query.trim().toLowerCase();

  const visible = entries.filter(
    (entry) =>
      (filter.actions.length === 0 || filter.actions.includes(entry.action)) &&
      (query === "" ||
        entry.snapshot.title.toLowerCase().includes(query) ||
        entry.actor.toLowerCase().includes(query)),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        {ACTIONS.map((action) => (
          <button
            key={action}
            type="button"
            data-active={filter.actions.includes(action)}
            aria-pressed={filter.actions.includes(action)}
            className="
              px-2.5 py-1 text-xs font-medium capitalize rounded-full border transition-colors focus-ring
              border-gray-400 text-gray-700 hover:border-indigo-600
              data-[active=true]:border-indigo-600 data-[active=true]:bg-indigo-600 data-[active=true]:text-white
            "
            onClick={() => toggleAction(action)}
          >
            {action}
          </button>
        ))}
        <input
          type="text"
          aria-label="Filter by title or user"
          placeholder="Filter by title or user"
          value={filter.query}
          className="px-3 py-1 ml-auto text-sm rounded border border-gray-400 placeholder:text-gray-600"
          onChange={(event) =>
            setFilter((current) => ({ ...current, query: event.target.value }))
          }
        />
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-gray-600">
          {entries.length === 0
            ? "No changes recorded yet."
            : "No entries match the current filters."}
        </p>
      ) : (
        <ol className="space-y-2">
          {visible.map((entry) => (
            <Entry
              key={keyOf(entry)}
              entry={entry}
              onUndo={undoing ? UNDO_DISABLED : () => handleUndo(entry)}
            />
          ))}
        </ol>
      )}
    </div>
  );
};

export default PublicationHistoryFeed;
