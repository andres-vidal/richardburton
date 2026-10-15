"use client";

import SpellcheckIcon from "assets/spellcheck.svg";
import { useBatchNames } from "modules/publication/hooks";
import type { BatchName, NameKind } from "modules/publication/store";
import { batchNamesAtom, replaceName } from "modules/publication/store";
import { usePublicationStore } from "modules/publication/workspace";
import { resemblances, type Resemblance } from "modules/vocabulary";
import { useTranslations } from "next-intl";
import { FC, useEffect, useState } from "react";
import Button from "./Button";
import { Modal, useModal } from "./Modal";
import OtherSpellings from "./OtherSpellings";
import SectionHeading from "./SectionHeading";

const KINDS: NameKind[] = ["authors", "publishers"];

/**
 * How long, in milliseconds, the names must stay unchanged before they are
 * sent to `ask`.
 */
const SETTLE = 500;

/**
 * The answers from `ask`, by kind. The component holds null until the first
 * answers arrive.
 */
type Answers = Record<NameKind, Resemblance[]>;

/**
 * One name of the batch, with the rows that carry it and the server's answer
 * for it. Until the answer arrives, `held` is false and `resembles` is empty.
 */
type Entry = BatchName & Resemblance;

/** True when the database lacks the name but has a name that resembles it. */
const isDoubtful = (entry: Entry) => !entry.held && entry.resembles.length > 0;

/**
 * One name of the batch: the name, how many rows carry it, and its state,
 * which is "doubtful", "held" or "new". A doubtful name also offers the stored
 * names it resembles, and picking one calls `onAdopt` with that spelling.
 */
const Name: FC<{
  entry: Entry;
  onAdopt: (entry: Entry, spelling: string) => void;
}> = ({ entry, onAdopt }) => {
  const t = useTranslations("workspaceNames");

  const state = isDoubtful(entry) ? "doubtful" : entry.held ? "held" : "new";

  return (
    <li
      className="py-2 px-3 rounded border border-gray-200 data-[state=doubtful]:border-amber-300 data-[state=doubtful]:bg-amber-50"
      data-state={state}
    >
      <div className="flex gap-3 items-baseline">
        <span className="text-sm grow">{entry.name}</span>
        <span className="text-xs text-gray-600 shrink-0 tabular-nums">
          {t("onRows", { count: entry.rows.length })}
        </span>
        <span
          className="text-xs shrink-0 w-24 text-right text-gray-500 data-[state=doubtful]:text-amber-800"
          data-state={state}
        >
          {t(state)}
        </span>
      </div>

      {state === "doubtful" && (
        <OtherSpellings
          label={t("didYouMean")}
          spellings={entry.resembles}
          onPick={(other) => onAdopt(entry, other.name)}
        />
      )}
    </li>
  );
};

/**
 * A footer button and dialog that list the translators, authors and publishers
 * the batch would enter, and mark the ones that may be misspellings of names
 * the database already has.
 *
 * A second spelling of a name creates a second record. Correcting it in the
 * batch is simpler than folding the two records after the insert. Picking an
 * offered spelling writes it into every row that has the name, as one edit.
 *
 * The names are sent to `ask` once they have stayed unchanged for half a
 * second, so typing a name does not send every prefix of it.
 */
const WorkspaceNames: FC<{
  /** Checks names against the database. Defaults to `resemblances`. */
  ask?: typeof resemblances;
}> = ({ ask = resemblances }) => {
  const t = useTranslations("workspaceNames");
  const store = usePublicationStore();
  const batch = useBatchNames();
  const { isOpen, open, close } = useModal();

  const [answers, setAnswers] = useState<Answers | null>(null);

  // The batch's names as a string, used as the effect's dependency. `batch` is
  // a new object after every edit, but this string changes only when a name
  // changes, so editing a year or a title does not send the names again.
  const asked = JSON.stringify(
    KINDS.map((kind) => batch[kind].map((one) => one.name)),
  );

  const anyNames = KINDS.some((kind) => batch[kind].length > 0);

  useEffect(() => {
    if (!anyNames) return;

    let current = true;
    const timer = setTimeout(async () => {
      // Reads the names from the store instead of using `batch`. `batch` is a
      // new object after every edit, so depending on it would rerun the effect
      // after every edit.
      const asking = store.get(batchNamesAtom);

      const [authors, publishers] = await Promise.all(
        KINDS.map((kind) =>
          ask(
            kind,
            asking[kind].map((one) => one.name),
          ),
        ),
      );

      if (current) setAnswers({ authors, publishers });
    }, SETTLE);

    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [asked, anyNames, ask, store]);

  // Returns the names of `kind`, each with the server's answer for it.
  const entries = (kind: NameKind): Entry[] => {
    const said = new Map((answers?.[kind] ?? []).map((one) => [one.name, one]));

    return batch[kind].map((one) => ({
      ...one,
      held: said.get(one.name)?.held ?? false,
      resembles: said.get(one.name)?.resembles ?? [],
    }));
  };

  const byKind = KINDS.map((kind) => ({ kind, entries: entries(kind) }));
  const all = byKind.flatMap(({ entries }) => entries);
  const doubtful = all.filter(isDoubtful);

  return all.length === 0 ? null : (
    <>
      <Button
        variant={doubtful.length > 0 ? "danger" : "outline"}
        width="fit"
        alignment="left"
        Icon={SpellcheckIcon}
        label={
          doubtful.length > 0
            ? t("doubtfulCount", { count: doubtful.length })
            : t("count", { count: all.length })
        }
        onClick={open}
      />

      <Modal
        isOpen={isOpen}
        onClose={close}
        heading={t("title")}
        subheading={t("description")}
      >
        {byKind.map(({ kind, entries }) => (
          <section key={kind} className="space-y-2">
            <SectionHeading>{t(kind)}</SectionHeading>

            {entries.length === 0 ? (
              <p className="text-sm text-gray-600">{t("noneOfThisKind")}</p>
            ) : (
              <ul aria-label={t(kind)} className="space-y-1">
                {entries.map((entry) => (
                  <Name
                    key={entry.name}
                    entry={entry}
                    onAdopt={(one, spelling) =>
                      replaceName(store, kind, one.rows, one.name, spelling)
                    }
                  />
                ))}
              </ul>
            )}
          </section>
        ))}
      </Modal>
    </>
  );
};

export default WorkspaceNames;
