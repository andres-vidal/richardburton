"use client";

import SpellcheckIcon from "assets/spellcheck.svg";
import { useBatchNames } from "modules/publication/hooks";
import type { BatchName, NameKind } from "modules/publication/store";
import { replaceName } from "modules/publication/store";
import { validate } from "modules/publication/remote";
import { usePublicationStore } from "modules/publication/workspace";
import { resemblances, type Resemblance } from "modules/vocabulary";
import { useTranslations } from "next-intl";
import { FC, useEffect, useState } from "react";
import Button from "./Button";
import { Modal, useModal } from "./Modal";

const KINDS: NameKind[] = ["authors", "publishers"];

/** How long the batch must sit still before it is asked about. */
const SETTLE = 500;

/** What the vocabulary said about each name, or nothing while it is being asked. */
type Answers = Record<NameKind, Resemblance[]>;

/**
 * One name of the batch, against what the database already holds.
 *
 * `held` and `resembles` come from the server; the rows are this workspace's.
 */
type Entry = BatchName & Resemblance;

/** A name that is not here but is close to something that is. */
const isDoubtful = (entry: Entry) => !entry.held && entry.resembles.length > 0;

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

      {isDoubtful(entry) && (
        <p className="flex flex-wrap gap-1.5 items-baseline pt-2 text-xs text-amber-900">
          {t("didYouMean")}
          {entry.resembles.map((other) => (
            <button
              key={other.id}
              type="button"
              className="py-0.5 px-2 bg-white rounded-full border border-amber-300 hover:bg-amber-100"
              onClick={() => onAdopt(entry, other.name)}
            >
              {other.name}{" "}
              <span className="text-amber-700 tabular-nums">
                {t("onPublications", { count: other.publications })}
              </span>
            </button>
          ))}
        </p>
      )}
    </li>
  );
};

/**
 * The translators, authors and publishers a batch would enter, and which of
 * them look like misspellings of names the database already holds.
 *
 * A name entered a second way is a second record, and every publication filed
 * under it sits apart from its fellows. Catching that here is cheaper than
 * catching it afterwards: before the insert it is a field to correct, after it
 * a fold to perform.
 *
 * The batch is asked about once it has been still for half a second, so typing
 * a name does not ask about every prefix of it.
 */
const WorkspaceNames: FC<{
  /** How the batch's names are asked about. Defaults to asking the server. */
  ask?: typeof resemblances;
  /** How corrected rows are checked again. Defaults to asking the server. */
  recheck?: typeof validate;
}> = ({ ask = resemblances, recheck = validate }) => {
  const t = useTranslations("workspaceNames");
  const store = usePublicationStore();
  const batch = useBatchNames();
  const { isOpen, open, close } = useModal();

  const [answers, setAnswers] = useState<Answers | null>(null);

  // The names themselves, so a change to a row that leaves them alone — a year,
  // a title — does not ask again.
  const asked = JSON.stringify(
    KINDS.map((kind) => batch[kind].map((one) => one.name)),
  );

  const anyNames = KINDS.some((kind) => batch[kind].length > 0);

  useEffect(() => {
    if (!anyNames) return;

    let current = true;
    const timer = setTimeout(async () => {
      const [authors, publishers] = await Promise.all(
        KINDS.map((kind) =>
          ask(
            kind,
            batch[kind].map((one) => one.name),
          ),
        ),
      );

      if (current) setAnswers({ authors, publishers });
    }, SETTLE);

    return () => {
      current = false;
      clearTimeout(timer);
    };
    // `batch` is re-derived on every edit; `asked` is what actually changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asked, anyNames, ask]);

  const entries = (kind: NameKind): Entry[] => {
    const said = new Map((answers?.[kind] ?? []).map((one) => [one.name, one]));

    return batch[kind].map((one) => ({
      ...one,
      held: said.get(one.name)?.held ?? false,
      resembles: said.get(one.name)?.resembles ?? [],
    }));
  };

  const all = KINDS.flatMap(entries);
  const doubtful = all.filter(isDoubtful);

  function handleAdopt(kind: NameKind, entry: Entry, spelling: string) {
    replaceName(store, kind, entry.rows, entry.name, spelling);
    recheck(store, entry.rows);
  }

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
        onClick={() => open()}
      />

      <Modal isOpen={isOpen} onClose={close} label={t("title")}>
        <div className="p-6 space-y-4 max-w-2xl">
          <div>
            <h1 className="text-xl">{t("title")}</h1>
            <p className="text-sm text-gray-600">{t("description")}</p>
          </div>

          {KINDS.map((kind) => (
            <section key={kind} className="space-y-1">
              <h2 className="text-sm font-medium text-gray-700">{t(kind)}</h2>

              {entries(kind).length === 0 ? (
                <p className="text-sm text-gray-600">{t("noneOfThisKind")}</p>
              ) : (
                <ul aria-label={t(kind)} className="space-y-1">
                  {entries(kind).map((entry) => (
                    <Name
                      key={entry.name}
                      entry={entry}
                      onAdopt={(one, spelling) =>
                        handleAdopt(kind, one, spelling)
                      }
                    />
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </Modal>
    </>
  );
};

export default WorkspaceNames;
