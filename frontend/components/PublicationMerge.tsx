"use client";

import { Publication } from "modules/publication/model";
import { merge, search } from "modules/publication/remote";
import { usePublicationStore } from "modules/publication/workspace";
import { ChangeEventHandler, FC, useState } from "react";
import useDebounce from "utils/useDebounce";
import Button from "./Button";
import { Modal } from "./Modal";
import SectionHeading from "./SectionHeading";

/** Long enough that a typist does not query on every letter. */
const SEARCH_DELAY_MS = 350;

type Props = {
  /** The record the others fold into: it keeps its identity and its address. */
  publication: Publication;
  isOpen: boolean;
  onClose: () => void;
  /** Run once the merge has happened, so the view showing the record can re-read it. */
  onMerged: () => void;
  /** How a term finds candidates. Defaults to searching the database. */
  find?: (term: string) => Promise<Publication[]>;
};

/** One publication as a line: enough of it to tell two near-identical records apart. */
const Summary: FC<{ publication: Publication }> = ({ publication: p }) => (
  <div className="min-w-0">
    <p className="text-sm truncate">
      {p.title} <span className="text-gray-600">({p.year})</span>
    </p>
    <p className="text-xs text-gray-600 truncate">
      {Publication.describeValue(p.countries, "countries")} · {p.publishers}
    </p>
  </div>
);

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

const items = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

/**
 * What the merge produces, before it is asked for: the survivor's countries,
 * publishers and sources with everything the others bring marked as gained.
 * A merge that adds nothing says so — picking a record that holds nothing new
 * still removes it, and that should not look like an accident.
 */
const Preview: FC<{ winner: Publication; losers: Publication[] }> = ({
  winner,
  losers,
}) => {
  const result = Publication.merged(winner, losers);
  const gained = (before: string[], after: string[]) =>
    after.filter((value) => !before.includes(value));

  const countries = gained(items(winner.countries), items(result.countries));
  const publishers = gained(items(winner.publishers), items(result.publishers));
  const references = gained(winner.references, result.references);

  return (
    <section className="space-y-2">
      <SectionHeading>Result</SectionHeading>
      <div className="space-y-1.5">
        <Gained
          label="Countries"
          kept={items(winner.countries)}
          gained={countries}
        />
        <Gained
          label="Publishers"
          kept={items(winner.publishers)}
          gained={publishers}
        />
        <Gained
          label="References"
          kept={winner.references}
          gained={references}
        />
      </div>
      {countries.length + publishers.length + references.length === 0 && (
        <p className="text-xs text-gray-500">
          Nothing new to take — “{winner.title}” already says everything the
          others do. Merging still removes them.
        </p>
      )}
    </section>
  );
};

/**
 * Collapse duplicates of a publication into it: find them, see what the record
 * becomes, and confirm.
 *
 * A merge is deliberately not undoable, so the dialog shows the outcome rather
 * than describing it — everything the survivor gains is marked before the
 * question is asked.
 */
const PublicationMerge: FC<Props> = ({
  publication,
  isOpen,
  onClose,
  onMerged,
  find: findPublications = search,
}) => {
  const store = usePublicationStore();

  const [term, setTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<Publication[]>([]);
  const [chosen, setChosen] = useState<Publication[]>([]);
  const [merging, setMerging] = useState(false);

  const find = useDebounce(async (value: string) => {
    if (!value.trim()) {
      setCandidates([]);
      setSearching(false);
      return;
    }
    setCandidates(await findPublications(value));
    setSearching(false);
  }, SEARCH_DELAY_MS);

  const handleTerm: ChangeEventHandler<HTMLInputElement> = (event) => {
    setTerm(event.target.value);
    setSearching(Boolean(event.target.value.trim()));
    find(event.target.value);
  };

  // A record cannot be folded into itself, and one already picked is offered
  // from the chosen list instead of twice.
  const offered = candidates.filter(
    (candidate) =>
      candidate.id !== publication.id &&
      !chosen.some((picked) => picked.id === candidate.id),
  );

  function reset() {
    setTerm("");
    setCandidates([]);
    setChosen([]);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleMerge() {
    setMerging(true);
    const merged = await merge(store, { winner: publication, losers: chosen });
    setMerging(false);

    if (merged) {
      reset();
      onMerged();
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} label="Merge publications">
      <div className="flex flex-col gap-5 p-8 w-full max-h-[80vh] overflow-y-auto">
        <div className="space-y-1">
          <h1 className="text-2xl font-normal">Merge into this publication</h1>
          <p className="text-sm text-gray-500">
            “{publication.title}” ({publication.year}) keeps its place. The
            records you pick leave the database, and what they hold stays here.
          </p>
        </div>

        <section className="space-y-2">
          <SectionHeading>Find the duplicates</SectionHeading>
          <input
            className="w-full py-2 px-3 bg-white rounded border border-gray-300 transition-colors outline-none placeholder:text-sm focus:bg-gray-100 hover:bg-gray-100"
            placeholder="Search by title, author, publisher or country"
            aria-label="Search for publications to merge"
            value={term}
            onChange={handleTerm}
          />
          <div aria-live="polite">
            {searching ? (
              <p className="text-xs text-gray-500">Searching…</p>
            ) : (
              term.trim() &&
              offered.length === 0 && (
                <p className="text-xs text-gray-500">
                  No other publication matches “{term}”.
                </p>
              )
            )}
          </div>
          <ul className="space-y-1">
            {offered.map((candidate) => (
              <li
                key={candidate.id}
                className="flex gap-3 justify-between items-center py-1.5 px-3 rounded border border-gray-200"
              >
                <Summary publication={candidate} />
                <Button
                  label="Add"
                  variant="outline-primary"
                  width="fit"
                  size="small"
                  onClick={() => setChosen([...chosen, candidate])}
                />
              </li>
            ))}
          </ul>
        </section>

        {chosen.length > 0 && (
          <section className="space-y-2">
            <SectionHeading>Merging in</SectionHeading>
            <ul className="space-y-1">
              {chosen.map((picked) => (
                <li
                  key={picked.id}
                  className="flex gap-3 justify-between items-center py-1.5 px-3 rounded border border-indigo-200 bg-indigo-50"
                >
                  <Summary publication={picked} />
                  <Button
                    label="Remove"
                    variant="outline"
                    width="fit"
                    size="small"
                    onClick={() =>
                      setChosen(chosen.filter((p) => p.id !== picked.id))
                    }
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {chosen.length > 0 && <Preview winner={publication} losers={chosen} />}

        <div className="flex gap-3 justify-end">
          <Button
            label="Cancel"
            variant="outline"
            width="fit"
            size="medium"
            onClick={handleClose}
          />
          <Button
            label={
              chosen.length > 1
                ? `Merge ${chosen.length} publications`
                : "Merge publication"
            }
            variant="danger"
            width="fit"
            size="medium"
            loading={merging}
            disabled={chosen.length === 0 || merging}
            onClick={handleMerge}
          />
        </div>
      </div>
    </Modal>
  );
};

export default PublicationMerge;
export type { Props as PublicationMergeProps };
