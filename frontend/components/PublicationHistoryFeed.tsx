"use client";

import type { WithChanges } from "modules/publication/history";
import { keyOf } from "modules/publication/history";
import type {
  FullHistoryEntry,
  PublicationHistoryAction,
} from "modules/publication/model";
import { HISTORY_ACTIONS } from "modules/publication/model";
import { useTranslations } from "next-intl";
import { FC, useState } from "react";
import { undo } from "modules/publication/remote";
import { useMutation } from "utils/useMutation";
import Button from "./Button";
import { Entry, UNDO_DISABLED } from "./PublicationHistory";
import TextInput from "./TextInput";

type FeedEntry = WithChanges<FullHistoryEntry>;

type Filter = { actions: PublicationHistoryAction[]; query: string };

/**
 * Returns the titles the text filter matches an entry by: its publication's,
 * and for a rename, those of the other publications the rename changed.
 */
function titlesOf(entry: FeedEntry): string[] {
  return entry.action === "renamed"
    ? [entry.snapshot.title, ...(entry.others ?? []).map(({ title }) => title)]
    : [entry.snapshot.title];
}

/**
 * Every recorded change across the database, newest first, each entry naming
 * its publication. Each entry arrives with its changes, which the server
 * compared with the previous version of the same record, so the filters only
 * narrow which entries are shown.
 *
 * The server sends each rename made in names management as one entry, so a
 * rename is one item that names the old and the new name and lists every
 * publication it changed.
 *
 * The filters are a toggle per action and a text that matches the
 * publication's title or the person who made the change. A rename matches the
 * title of any publication it changed. The filters are kept in the component
 * and not in the address.
 *
 * Every entry the server marks `undoable` has an Undo button, which calls
 * `onUndo` with the entry. `onUndo` defaults to `undo`, which asks the server
 * to undo the entry. While one undo runs, the other Undo buttons are disabled.
 * A successful undo reads the page again, since the undo adds an entry and can
 * change which other entries are undoable.
 */
const PublicationHistoryFeed: FC<{
  entries: FeedEntry[];
  onUndo?: (entry: FeedEntry) => Promise<boolean>;
}> = ({
  entries,
  onUndo = (entry) => undo(entry.publicationId, entry.version),
}) => {
  const t = useTranslations("admin");
  const actionName = useTranslations("historyActions");
  const [filter, setFilter] = useState<Filter>({ actions: [], query: "" });
  const { pending: undoing, run } = useMutation();

  async function handleUndo(entry: FeedEntry) {
    await run(() => onUndo(entry));
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
        titlesOf(entry).some((title) => title.toLowerCase().includes(query)) ||
        entry.actor.toLowerCase().includes(query)),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        {HISTORY_ACTIONS.map((action) => (
          <Button
            key={action}
            label={actionName(action)}
            variant={filter.actions.includes(action) ? "primary" : "outline"}
            width="fit"
            size="small"
            aria-pressed={filter.actions.includes(action)}
            onClick={() => toggleAction(action)}
          />
        ))}
        <span className="ml-auto w-full sm:w-64">
          <TextInput
            bordered
            aria-label={t("filter")}
            placeholder={t("filter")}
            value={filter.query}
            onChange={(query) =>
              setFilter((current) => ({ ...current, query }))
            }
          />
        </span>
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-gray-600">
          {entries.length === 0 ? t("noChangesYet") : t("noMatchingEntries")}
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
