"use client";

import { Link } from "i18n/navigation";
import { useFormatDate } from "modules/dates";
import type { RenameChange, WithChanges } from "modules/publication/history";
import {
  sourceLine,
  type PublicationHistoryEntry,
} from "modules/publication/model";
import { isBlank, type RichTextValue } from "modules/rich-text";
import { useTranslations } from "next-intl";
import { FC, useState } from "react";
import Button from "./Button";
import RichText from "./RichText";

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

/**
 * The name of an entry's action as a tinted badge of fixed width, so the
 * subjects of the entries line up. The colour comes from the `data-action` of
 * the entry around it, and the size from `variant`.
 */
const ActionBadge: FC<{
  action: PublicationHistoryEntry["action"];
  variant: Variant;
}> = ({ action, variant }) => {
  const t = useTranslations("historyActions");

  return (
    <span
      data-variant={variant}
      className="
      inline-block shrink-0 font-medium text-center rounded-full
      data-[variant=card]:w-20 data-[variant=card]:py-0.5 data-[variant=card]:text-xs
      data-[variant=plain]:w-16 data-[variant=plain]:text-[0.6875rem]
      group-data-[action=created]:bg-indigo-100 group-data-[action=created]:text-indigo-700
      group-data-[action=updated]:bg-amber-100 group-data-[action=updated]:text-amber-800
      group-data-[action=deleted]:bg-red-100 group-data-[action=deleted]:text-red-700
      group-data-[action=restored]:bg-emerald-100 group-data-[action=restored]:text-emerald-700
      group-data-[action=merged]:bg-sky-100 group-data-[action=merged]:text-sky-700
      group-data-[action=unmerged]:bg-sky-100 group-data-[action=unmerged]:text-sky-700
      group-data-[action=renamed]:bg-violet-100 group-data-[action=renamed]:text-violet-700
      group-data-[action=distinguished]:bg-teal-100 group-data-[action=distinguished]:text-teal-700
      group-data-[action=reconsidered]:bg-gray-100 group-data-[action=reconsidered]:text-gray-700
    "
    >
      {t(action)}
    </span>
  );
};

/**
 * The message that heads a rename's entry in each variant, for a rename that
 * gave the publications a new name (`renamed`) and for a fold into a name
 * they already credit (`folded`). The `plain` variant, in a publication's
 * own log, also says that the change was made in Names.
 */
const RENAME_HEADINGS = {
  card: { renamed: "nameRenamed", folded: "nameFolded" },
  plain: { renamed: "nameRenamedInNames", folded: "nameFoldedInNames" },
} as const;

/**
 * The publications a rename changed, each as a link to its page that reads its
 * title and year, under `label`.
 */
const RenamedPublications: FC<{
  label: string;
  publications: RenameChange["publications"];
}> = ({ label, publications }) => {
  const t = useTranslations("admin");

  return (
    <>
      {label}
      <ul className="mt-1 space-y-0.5">
        {publications.map((publication) => (
          <li
            key={publication.id}
            className="pl-2 border-l-2 border-violet-200"
          >
            <Link href={`/publications/${publication.id}`} className="anchor">
              {publication.title || t("untitledRecord")} ({publication.year})
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
};

/**
 * Notes as an entry of the log shows them: rendered with `RichText` in the
 * small size, or the `admin.noNotes` message when they are null or blank.
 */
const NotesOrNone: FC<{ notes: RichTextValue | null }> = ({ notes }) => {
  const t = useTranslations("admin");

  return isBlank(notes) ? (
    t("noNotes")
  ) : (
    <RichText value={notes} size="small" />
  );
};

/**
 * One entry of a publication's log: its action, who made it and when, and what
 * it changed. The `card` variant names the publication and frames the entry,
 * and the `plain` variant does neither.
 *
 * What it changed is listed from `entry.changes`: a field's old and new value,
 * the sources added and removed, each with its text in each language it has
 * one in, the notes in each language before and after, rendered with
 * `RichText`, the records a merge took in or gave back, and the records a
 * duplicate decision was about. An update with no earlier version to compare
 * with says so. Blank notes are shown as none.
 *
 * A rename's entry with a `RenameChange` reads as a change of the name, not
 * of the publication. The `card` variant heads it with the name before and
 * after, in place of the publication's title, and lists every publication the
 * rename changed. The `plain` variant states the change, says it was made in
 * Names, and lists the other publications the rename changed. Each listed
 * publication links to its page. A rename's entry without a `RenameChange`
 * is shown like an update, with a note that a name was changed in Names.
 */
const Entry: FC<{
  entry: HistoryEntry;
  /**
   * Undoes this entry. The entry shows an Undo button only when this is given
   * and `entry.undoable` is true. `UNDO_DISABLED` shows the button disabled.
   * The button spins until the promise settles.
   */
  onUndo?: UndoHandler;
  variant?: Variant;
}> = ({ entry, onUndo, variant = "card" }) => {
  const attribute = useTranslations("attributes");
  const notes = useTranslations("notes");
  const t = useTranslations("admin");
  const formatDate = useFormatDate();
  const [undoing, setUndoing] = useState(false);

  const rename = entry.changes.find(
    (change): change is RenameChange => change.kind === "rename",
  );
  const heading =
    rename === undefined
      ? null
      : t(RENAME_HEADINGS[variant][rename.to === null ? "folded" : "renamed"], {
          role: rename.role,
          from: rename.from,
          to: rename.to ?? "",
        });
  const subject =
    variant !== "card" ? null : (heading ?? `“${entry.snapshot.title}”`);
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
          <span className="min-w-0 font-medium text-gray-800 wrap-break-word">
            {subject}
          </span>
        ) : (
          <>
            <span className="min-w-0 text-gray-600 wrap-break-word">
              {t("byActor", { actor: entry.actor })}
            </span>
            <span className="ml-auto text-gray-500 whitespace-nowrap shrink-0">
              {formatDate(entry.timestamp)}
            </span>
          </>
        )}
        {onUndo && entry.undoable && (
          <span className="flex shrink-0 justify-end ml-auto">
            <Button
              label={t("undo")}
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
          className="mt-0.5 text-gray-500 wrap-break-word data-[variant=card]:pl-22 data-[variant=plain]:pl-18"
        >
          {t("byActorOn", {
            actor: entry.actor,
            date: formatDate(entry.timestamp),
          })}
        </p>
      )}
      {entry.action === "updated" && entry.diff === null && (
        <p
          data-variant={variant}
          className="mt-2 text-xs text-gray-500 italic data-[variant=card]:pl-22 data-[variant=plain]:pl-18"
        >
          {t("noBaseline")}
        </p>
      )}
      {entry.action === "renamed" && rename === undefined ? (
        <p
          data-variant={variant}
          className="mt-2 text-xs text-gray-500 data-[variant=card]:pl-22 data-[variant=plain]:pl-18"
        >
          {t("renamedNote")}
        </p>
      ) : null}
      {entry.changes.length > 0 && (
        <ul
          data-variant={variant}
          className="mt-2 space-y-0.5 data-[variant=card]:pl-22 data-[variant=plain]:pl-18"
        >
          {entry.changes.map((change) =>
            change.kind === "field" ? (
              <li key={change.attribute} className="text-xs text-gray-600">
                {attribute(change.attribute)}:{" "}
                <s className="text-gray-500">{change.from}</s> →{" "}
                <span className="text-gray-700">{change.to}</span>
              </li>
            ) : change.kind === "sources" ? (
              <li key="sources" className="text-xs text-gray-600">
                {attribute("sources")}:
                {change.reordered ? ` ${t("reordered")}` : null}
                <ul className="space-y-0.5">
                  {change.removed.map((source) => (
                    <li
                      key={`− ${sourceLine(source)}`}
                      className="text-red-700"
                    >
                      − <s>{sourceLine(source)}</s>
                    </li>
                  ))}
                  {change.added.map((source) => (
                    <li
                      key={`+ ${sourceLine(source)}`}
                      className="text-emerald-700"
                    >
                      + {sourceLine(source)}
                    </li>
                  ))}
                </ul>
              </li>
            ) : change.kind === "notes" ? (
              <li
                key={`notes ${change.language}`}
                className="text-xs text-gray-600"
              >
                {notes("field", { language: change.language })}:
                <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 mt-0.5">
                  <span aria-hidden className="text-red-700">
                    −
                  </span>
                  <del className="text-gray-500 no-underline">
                    <NotesOrNone notes={change.from} />
                  </del>
                  <span aria-hidden className="text-emerald-700">
                    +
                  </span>
                  <ins className="no-underline">
                    <NotesOrNone notes={change.to} />
                  </ins>
                </div>
              </li>
            ) : change.kind === "rename" ? (
              <li key="rename" className="text-xs text-gray-600">
                {variant === "card" ? (
                  <RenamedPublications
                    label={t("renamedIn", {
                      count: change.publications.length,
                    })}
                    publications={change.publications}
                  />
                ) : (
                  <>
                    <p className="text-gray-700">{heading}</p>
                    {change.others.length === 0 ? null : (
                      <div className="mt-1">
                        <RenamedPublications
                          label={t("renamedAlsoIn")}
                          publications={change.others}
                        />
                      </div>
                    )}
                  </>
                )}
              </li>
            ) : change.kind === "related" ? (
              <li key="related" className="mt-1 text-xs text-gray-600">
                {change.direction === "apart"
                  ? t("notDuplicateOf")
                  : t("reviewAgainWith")}
                <ul className="mt-1 space-y-0.5">
                  {change.records.map((record) => (
                    <li
                      key={record.id}
                      className="pl-2 border-l-2 border-teal-200"
                    >
                      <span className="font-medium text-gray-700">
                        {record.title || t("untitledRecord")}
                      </span>{" "}
                      <span className="text-gray-500">
                        ({record.year}) · {record.authors}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ) : (
              <li key="absorbed" className="mt-1 text-xs text-gray-600">
                {change.direction === "in" ? t("tookIn") : t("gaveBack")}
                <ul className="mt-1 space-y-1.5">
                  {change.records.map((record) => (
                    <li
                      key={record.id}
                      className="pl-2 border-l-2 border-sky-200"
                    >
                      <span className="font-medium text-gray-700">
                        {record.title || t("untitledRecord")}
                      </span>
                      <ul className="space-y-0.5">
                        {record.fields.map((field) => (
                          <li key={field.attribute} className="text-gray-500">
                            {attribute(field.attribute)}: {field.value}
                          </li>
                        ))}
                        {record.sources.map((source) => (
                          <li
                            key={sourceLine(source)}
                            className="text-gray-500"
                          >
                            {t("sourceLabel", { source: sourceLine(source) })}
                          </li>
                        ))}
                        {record.notes.map(({ language, value }) => (
                          <li key={language} className="text-gray-500">
                            {notes("field", { language })}:
                            <div lang={language}>
                              <RichText value={value} size="small" />
                            </div>
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
 * A publication's log, newest first: who did what, when, and what each change
 * was. The entries use the `plain` variant, with no frame and smaller type. A
 * log with no entries says that the record predates the log.
 */
const PublicationHistory: FC<{ entries: HistoryEntry[] }> = ({ entries }) => {
  const t = useTranslations("admin");

  return (
    <div>
      {entries.length === 0 ? (
        <p className="text-xs text-gray-500">{t("noRecordedChanges")}</p>
      ) : (
        <ol className="space-y-2.5">
          {entries.map((entry) => (
            <Entry key={entry.version} entry={entry} variant="plain" />
          ))}
        </ol>
      )}
    </div>
  );
};

export default PublicationHistory;
export { Entry, UNDO_DISABLED };
export type { HistoryEntry, UndoHandler };
