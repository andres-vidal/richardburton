"use client";

import { formatDate } from "modules/dates";
import type { WithChanges } from "modules/publication/history";
import type { PublicationHistoryEntry } from "modules/publication/model";
import { FC, useState } from "react";
import Button from "./Button";

type HistoryEntry = WithChanges<PublicationHistoryEntry>;

/**
 * How an entry is chromed: `card` for the standalone admin feed, `plain` for
 * the publication modal, where the log is a supporting detail inside an
 * already-framed dialog and card borders would only add noise.
 */
type Variant = "card" | "plain";

/**
 * Passed in place of a handler when the control belongs on an entry but cannot
 * be used right now — another undo is already in flight. Distinct from omitting
 * `onUndo` altogether, which says the entry is not undoable at all and so gets
 * no control: a refused click should look refused, not look like nothing.
 */
const UNDO_DISABLED = Symbol("undo disabled");

type UndoHandler = (() => Promise<void>) | typeof UNDO_DISABLED;

// A fixed-width, soft-tinted pill per action (the app's badge idiom), so the
// action column aligns and every subject starts at the same x. Colour comes
// from the ancestor's data-action and size from its own data-variant — two
// independent attributes, per the project's styling convention.
const ActionBadge: FC<{
  action: PublicationHistoryEntry["action"];
  variant: Variant;
}> = ({ action, variant }) => (
  <span
    data-variant={variant}
    className="
      inline-block shrink-0 font-medium text-center capitalize rounded-full
      data-[variant=card]:w-20 data-[variant=card]:py-0.5 data-[variant=card]:text-xs
      data-[variant=plain]:w-16 data-[variant=plain]:text-[0.6875rem]
      group-data-[action=created]:bg-indigo-100 group-data-[action=created]:text-indigo-700
      group-data-[action=updated]:bg-amber-100 group-data-[action=updated]:text-amber-800
      group-data-[action=deleted]:bg-red-100 group-data-[action=deleted]:text-red-700
      group-data-[action=restored]:bg-emerald-100 group-data-[action=restored]:text-emerald-700
      group-data-[action=merged]:bg-sky-100 group-data-[action=merged]:text-sky-700
      group-data-[action=unmerged]:bg-sky-100 group-data-[action=unmerged]:text-sky-700
    "
  >
    {action}
  </span>
);

const Entry: FC<{
  entry: HistoryEntry;
  /**
   * Undo this entry — offered only where the view has somewhere to send it, so
   * the modal's read-only log passes nothing and renders no control. Whether
   * the *entry* admits an undo is `entry.undoable`, which the server decides;
   * both must hold. `UNDO_DISABLED` is the third case: it belongs here but is
   * barred for now. Resolve it when the list has settled — the row spins until
   * then.
   */
  onUndo?: UndoHandler;
  variant?: Variant;
}> = ({ entry, onUndo, variant = "card" }) => {
  const [undoing, setUndoing] = useState(false);

  const subject = variant === "card" ? entry.snapshot.title : null;
  const disabled = undoing || onUndo === UNDO_DISABLED;

  async function handleUndo() {
    if (typeof onUndo !== "function") return;
    setUndoing(true);
    try {
      await onUndo();
    } finally {
      setUndoing(false);
    }
  }

  return (
    <li
      data-action={entry.action}
      data-variant={variant}
      className="
        text-gray-700 group
        data-[variant=card]:p-3 data-[variant=card]:text-sm
        data-[variant=card]:bg-white data-[variant=card]:rounded-lg data-[variant=card]:border data-[variant=card]:border-gray-200
        data-[variant=plain]:text-xs
      "
    >
      <div className="flex gap-2 items-baseline">
        <ActionBadge action={entry.action} variant={variant} />
        {subject ? (
          <span className="font-medium text-gray-800 wrap-break-words">
            “{subject}”
          </span>
        ) : (
          <>
            <span className="text-gray-600 wrap-break-words">
              by {entry.actor}
            </span>
            <span className="ml-auto text-gray-500 whitespace-nowrap shrink-0">
              {formatDate(entry.timestamp)}
            </span>
          </>
        )}
        {onUndo && entry.undoable && (
          <span className="flex shrink-0 justify-end ml-auto">
            <Button
              label="Undo"
              variant="outline"
              width="fit"
              size="small"
              loading={undoing}
              disabled={disabled}
              onClick={handleUndo}
            />
          </span>
        )}
      </div>
      {subject && (
        <p
          data-variant={variant}
          className="mt-0.5 text-gray-500 wrap-break-words data-[variant=card]:pl-22 data-[variant=plain]:pl-18"
        >
          by {entry.actor} · {formatDate(entry.timestamp)}
        </p>
      )}
      {entry.action === "updated" && entry.diff === null && (
        <p
          data-variant={variant}
          className="mt-2 text-xs text-gray-500 italic data-[variant=card]:pl-22 data-[variant=plain]:pl-18"
        >
          Nothing earlier to compare with — this is where the record&apos;s log
          starts.
        </p>
      )}
      {entry.changes.length > 0 && (
        <ul
          data-variant={variant}
          className="mt-2 space-y-0.5 data-[variant=card]:pl-22 data-[variant=plain]:pl-18"
        >
          {entry.changes.map((change) =>
            change.kind === "field" ? (
              <li key={change.label} className="text-xs text-gray-600">
                {change.label}: <s className="text-gray-500">{change.from}</s> →{" "}
                <span className="text-gray-700">{change.to}</span>
              </li>
            ) : change.kind === "sources" ? (
              <li key="sources" className="text-xs text-gray-600">
                Sources:{change.reordered ? " reordered" : null}
                <ul className="space-y-0.5">
                  {change.removed.map((source) => (
                    <li key={`− ${source}`} className="text-red-700">
                      − <s>{source}</s>
                    </li>
                  ))}
                  {change.added.map((source) => (
                    <li key={`+ ${source}`} className="text-emerald-700">
                      + {source}
                    </li>
                  ))}
                </ul>
              </li>
            ) : (
              <li key="absorbed" className="mt-1 text-xs text-gray-600">
                {change.direction === "in" ? "Took in" : "Gave back"}
                <ul className="mt-1 space-y-1.5">
                  {change.records.map((record) => (
                    <li
                      key={record.id}
                      className="pl-2 border-l-2 border-sky-200"
                    >
                      <span className="font-medium text-gray-700">
                        {record.title}
                      </span>
                      <ul className="space-y-0.5">
                        {record.fields.map((field) => (
                          <li key={field.label} className="text-gray-500">
                            {field.label}: {field.value}
                          </li>
                        ))}
                        {record.sources.map((source) => (
                          <li key={source} className="text-gray-500">
                            Source: {source}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </li>
            ),
          )}
        </ul>
      )}
    </li>
  );
};

/**
 * A publication's mutation log, newest first: who did what, when, and — for
 * updates — which fields changed. Rendered plain (no card chrome, smaller
 * type): inside the publication modal this is a supporting detail, not the
 * page's subject. Records created before the history log have no entries; that
 * absence is stated rather than hidden.
 */
const PublicationHistory: FC<{ entries: HistoryEntry[] }> = ({ entries }) => (
  <div>
    {entries.length === 0 ? (
      <p className="text-xs text-gray-500">
        No recorded changes — this record predates the history log.
      </p>
    ) : (
      <ol className="space-y-2.5">
        {entries.map((entry) => (
          <Entry key={entry.version} entry={entry} variant="plain" />
        ))}
      </ol>
    )}
  </div>
);

export default PublicationHistory;
export { Entry, UNDO_DISABLED };
export type { HistoryEntry, UndoHandler };
