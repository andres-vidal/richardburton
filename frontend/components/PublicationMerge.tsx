"use client";

import { isEqual } from "lodash";
import {
  useErrorSentence,
  usePublicationMarking,
} from "modules/publication/hooks";
import { NOTES_MAX_LENGTH, Publication } from "modules/publication/model";
import { loadPublication, merge, search } from "modules/publication/remote";
import { usePublicationStore } from "modules/publication/workspace";
import { isBlank, isLongerThan, type RichTextValue } from "modules/rich-text";
import { useTranslations } from "next-intl";
import { ChangeEventHandler, FC, ReactNode, useMemo, useState } from "react";
import useLookup from "utils/useLookup";
import Button from "./Button";
import Highlight from "./Highlight";
import LazyRichTextArea from "./LazyRichTextArea";
import { Modal } from "./Modal";
import ModalHeading from "./ModalHeading";
import { SEARCH_INPUT_CLASS_NAME } from "./PublicationSearch";
import SectionHeading from "./SectionHeading";

type Props = {
  /** The record the others fold into: it keeps its identity and its address. */
  publication: Publication;
  isOpen: boolean;
  onClose: () => void;
  /** Run once the merge has happened, so the view showing the record can re-read it. */
  onMerged: () => void;
  /**
   * Finds the candidates for a term, which it receives in lower case. Defaults
   * to searching the database.
   */
  find?: (term: string) => Promise<Publication[]>;
  /**
   * Reads the stored publication `id` in full, its notes included. Defaults to
   * reading it from the database.
   */
  read?: (id: number) => Promise<Publication>;
};

/**
 * A record picked to merge in: `publication`, the record as the search found
 * it, and `read`, the record read in full, `reading` while it is being read, or
 * `failed` when reading it failed.
 */
type Picked = {
  publication: Publication;
  read: Publication | "reading" | "failed";
};

// Every attribute but the title and the year, which `Summary` shows first.
const DETAILED = Publication.ATTRIBUTES.filter(
  (key) => key !== "title" && key !== "year",
);

/**
 * One publication in full: its title and year, every other attribute it
 * holds, and its sources. Nothing is cut short, since records that look alike
 * are told apart by the details they differ in.
 */
const Summary: FC<{ publication: Publication }> = ({ publication: p }) => {
  const t = useTranslations("attributes");
  const marked = usePublicationMarking();

  return (
    <div className="min-w-0">
      <p className="text-sm">
        {p.title} <span className="text-gray-600">({p.year})</span>
      </p>
      <dl className="mt-0.5 text-xs text-gray-600">
        {DETAILED.map((key) => {
          const value = marked.value(p, key);

          return value ? (
            <div key={key} className="flex gap-1">
              <dt className="text-gray-600 shrink-0">{t(key)}:</dt>
              <dd className="min-w-0 wrap-break-word">
                <Highlight>{value}</Highlight>
              </dd>
            </div>
          ) : null;
        })}
        {p.sources?.length > 0 && (
          <div className="flex gap-1">
            <dt className="text-gray-600 shrink-0">{t("sources")}:</dt>
            <dd className="min-w-0 wrap-break-word">
              <ul>
                {p.sources.map((source) => (
                  <li key={source}>{source}</li>
                ))}
              </ul>
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
};

/**
 * A field of the merged record, with what the merge adds to it set apart from
 * what the survivor already said.
 */
const Gained: FC<{ label: string; kept: string[]; gained: string[] }> = ({
  label,
  kept,
  gained,
}) => (
  <div className="flex gap-2 items-baseline text-sm">
    <span className="w-24 text-xs text-gray-500 shrink-0">{label}</span>
    <p className="flex flex-wrap gap-1.5">
      {kept.map((value) => (
        <span key={value} className="text-gray-700">
          {value}
        </span>
      ))}
      {gained.map((value) => (
        <span
          key={value}
          className="px-1.5 rounded bg-emerald-100 text-emerald-800"
        >
          {value}
        </span>
      ))}
    </p>
  </div>
);

/**
 * The Result section: the countries, publishers and sources of `result`, the
 * merged record, with everything that `winner`, the survivor, did not hold
 * marked as gained, followed by `children`. When `notesGained` is false and
 * nothing else is gained, it says that the others bring nothing new and that
 * merging still removes them. `notesGained` is null while it is not known yet,
 * and the section then says nothing about it.
 */
const Preview: FC<{
  winner: Publication;
  result: Publication;
  notesGained: boolean | null;
  children?: ReactNode;
}> = ({ winner, result, notesGained, children }) => {
  const attribute = useTranslations("attributes");
  const t = useTranslations("merge");

  const rows = [
    {
      label: attribute("countries"),
      kept: winner.countries,
      all: result.countries,
    },
    {
      label: attribute("publishers"),
      kept: winner.publishers,
      all: result.publishers,
    },
    { label: attribute("sources"), kept: winner.sources, all: result.sources },
  ].map(({ label, kept, all }) => ({
    label,
    kept,
    gained: all.filter((value) => !kept.includes(value)),
  }));

  return (
    <section aria-label={t("result")} className="space-y-2">
      <SectionHeading>{t("result")}</SectionHeading>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <Gained key={row.label} {...row} />
        ))}
      </div>
      {notesGained === false &&
        rows.every((row) => row.gained.length === 0) && (
          <p className="text-xs text-gray-500">
            {t("nothingNew", { title: winner.title })}
          </p>
        )}
      {children}
    </section>
  );
};

/**
 * A dialog that merges duplicates into `publication`: find them, see what the
 * record becomes, and confirm.
 *
 * The search runs through `useLookup`, so it waits for typing to pause and
 * only the newest search fills the list. The search finds records without
 * their notes, so each record picked is read in full with `read`. While a
 * picked record is being read, or when reading it failed, Merge is disabled,
 * and a record that could not be read says so.
 *
 * The Result shows what the survivor gains before the merge is asked for.
 * When the survivor or a picked record has notes, the Result also has a Notes
 * field, prefilled with the proposed notes: the survivor's notes, then each
 * picked record's notes in the order they were picked, without notes that are
 * blank or that equal earlier ones (see `Publication.merged`). The field is
 * shown once every picked record is read. The notes in the field are the
 * notes the merge sends, and the merged record keeps them. When the field is
 * not shown, the merge sends no notes.
 *
 * Until the notes are edited, picking or removing a record proposes the notes
 * again. Once they are edited, the field keeps the edited notes, whatever is
 * picked or removed, until the dialog closes. The field then stays shown even
 * when no record left has notes, since the edited notes are what the merge
 * sends.
 *
 * Notes longer than `NOTES_MAX_LENGTH` characters, and notes the server
 * refuses, have their error under the field, and Merge is disabled until they
 * are edited. Closing the dialog clears the search, the picks and the notes.
 */
const PublicationMerge: FC<Props> = ({
  publication,
  isOpen,
  onClose,
  onMerged,
  find: findPublications = search,
  read: readPublication = loadPublication,
}) => {
  const t = useTranslations("merge");
  const attribute = useTranslations("attributes");
  const note = useTranslations("notes");
  const store = usePublicationStore();

  const [term, setTerm] = useState("");
  const [candidates, setCandidates] = useState<Publication[]>([]);
  // The records picked to merge in, in the order they were picked.
  const [picks, setPicks] = useState<Picked[]>([]);
  // The notes as they were edited, or undefined until they are edited.
  const [edited, setEdited] = useState<RichTextValue | null | undefined>();
  // The code of the server's refusal of the notes, or an empty string when it
  // has not refused them since they were last edited.
  const [refusal, setRefusal] = useState("");
  const [merging, setMerging] = useState(false);
  const {
    lookup,
    cancel,
    busy: searching,
  } = useLookup<Publication>(findPublications);

  const handleTerm: ChangeEventHandler<HTMLInputElement> = async (event) => {
    const typed = event.target.value;
    setTerm(typed);
    if (!typed.trim()) setCandidates([]);

    const found = await lookup(typed.trim());
    if (found) setCandidates(found);
  };

  // A record cannot be folded into itself, and one already picked is offered
  // from the chosen list instead of twice.
  const offered = candidates.filter(
    (candidate) =>
      candidate.id !== publication.id &&
      !picks.some((picked) => picked.publication.id === candidate.id),
  );

  const allRead = picks.every(({ read }) => typeof read !== "string");
  // The survivor with the picked records merged in, each as it was read in
  // full, or as the search found it while it is not read.
  const result = useMemo(
    () =>
      Publication.merged(
        publication,
        picks.map(({ publication: found, read }) =>
          typeof read === "string" ? found : read,
        ),
      ),
    [publication, picks],
  );

  const proposal = result.notes ?? null;
  const notes =
    edited !== undefined ? edited : isBlank(proposal) ? null : proposal;
  const showsNotes = allRead && (!isBlank(proposal) || edited !== undefined);
  const notesGained = allRead
    ? !isEqual(proposal, publication.notes ?? null)
    : null;
  const notesCode =
    showsNotes && isLongerThan(notes, NOTES_MAX_LENGTH) ? "too_long" : refusal;
  const notesError = useErrorSentence(notesCode);

  // Picks `candidate`, and reads it in full, so its notes are known.
  async function pick(candidate: Publication) {
    const id = candidate.id!;

    setPicks((before) => [
      ...before,
      { publication: candidate, read: "reading" },
    ]);

    const read = await readPublication(id).catch(() => "failed" as const);
    setPicks((before) =>
      before.map((picked) =>
        picked.publication.id === id ? { ...picked, read } : picked,
      ),
    );
  }

  function unpick(picked: Publication) {
    setPicks((before) =>
      before.filter((other) => other.publication.id !== picked.id),
    );
  }

  function handleNotes(value: RichTextValue | null) {
    setEdited(value);
    setRefusal("");
  }

  function reset() {
    cancel();
    setTerm("");
    setCandidates([]);
    setPicks([]);
    setEdited(undefined);
    setRefusal("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleMerge() {
    setMerging(true);
    const answer = await merge(store, {
      winner: publication,
      losers: picks.map((picked) => picked.publication),
      ...(showsNotes ? { notes } : {}),
    });
    setMerging(false);

    if (answer.outcome === "merged") {
      reset();
      onMerged();
    } else if (answer.outcome === "refused") {
      setRefusal(answer.notes);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} label={t("label")}>
      <div className="flex flex-col gap-5 p-8 w-full h-full sm:h-[70vh]">
        <ModalHeading
          heading={t("heading")}
          subheading={t("subheading", {
            title: publication.title,
            year: publication.year,
          })}
        />

        <section className="space-y-2 shrink-0">
          <SectionHeading>{t("find")}</SectionHeading>
          <input
            className={SEARCH_INPUT_CLASS_NAME}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchLabel")}
            value={term}
            onChange={handleTerm}
          />
          <div aria-live="polite">
            {searching ? (
              <p className="text-xs text-gray-500">{t("searching")}</p>
            ) : (
              term.trim() &&
              offered.length === 0 && (
                <p className="text-xs text-gray-500">
                  {t("noMatches", { term })}
                </p>
              )
            )}
          </div>
        </section>

        <div className="flex overflow-y-auto flex-col gap-5 pr-1 min-h-0 grow">
          <ul className="space-y-1">
            {offered.map((candidate) => (
              <li
                key={candidate.id}
                className="flex gap-3 justify-between items-start py-1.5 px-3 rounded border border-gray-200"
              >
                <Summary publication={candidate} />
                <Button
                  label={t("add")}
                  variant="outline-primary"
                  width="fit"
                  size="small"
                  onClick={() => pick(candidate)}
                />
              </li>
            ))}
          </ul>

          {picks.length > 0 && (
            <>
              <section className="space-y-2">
                <SectionHeading>{t("mergingIn")}</SectionHeading>
                <ul className="space-y-1">
                  {picks.map(({ publication: picked, read }) => (
                    <li
                      key={picked.id}
                      className="flex gap-3 justify-between items-start py-1.5 px-3 rounded border border-indigo-200 bg-indigo-50"
                    >
                      <div className="min-w-0">
                        <Summary publication={picked} />
                        {read === "failed" && (
                          <p role="alert" className="mt-1 text-xs text-red-600">
                            {t("readFailed")}
                          </p>
                        )}
                      </div>
                      <Button
                        label={t("remove")}
                        variant="outline"
                        width="fit"
                        size="small"
                        onClick={() => unpick(picked)}
                      />
                    </li>
                  ))}
                </ul>
              </section>

              <Preview
                winner={publication}
                result={result}
                notesGained={notesGained}
              >
                {showsNotes && (
                  <LazyRichTextArea
                    label={attribute("notes")}
                    hint={t("notesHint")}
                    placeholder={note("placeholder")}
                    value={notes}
                    error={notesError}
                    onChange={handleNotes}
                  />
                )}
              </Preview>
            </>
          )}
        </div>

        <div className="flex gap-3 justify-end shrink-0">
          <Button
            label={t("cancel")}
            variant="outline"
            width="fit"
            size="medium"
            onClick={handleClose}
          />
          <Button
            label={t("confirm", { count: picks.length })}
            variant="danger"
            width="fit"
            size="medium"
            loading={merging}
            disabled={picks.length === 0 || !allRead || notesCode !== ""}
            onClick={handleMerge}
          />
        </div>
      </div>
    </Modal>
  );
};

export default PublicationMerge;
export type { Props as PublicationMergeProps };
