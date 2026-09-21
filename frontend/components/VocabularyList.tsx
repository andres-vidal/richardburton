"use client";

import Button from "components/Button";
import ConfirmationModal from "components/ConfirmationModal";
import TextInput from "components/TextInput";
import { notify } from "components/Notifications";
import {
  list,
  rename,
  type Clashing,
  type Kind,
  type Name,
} from "modules/vocabulary";
import { useTranslations } from "next-intl";
import { FC, useCallback, useEffect, useRef, useState } from "react";

const KINDS: Kind[] = ["authors", "publishers"];

/** A fold the server will not perform until it has been asked for. */
type Fold = {
  /** The name being renamed away. */
  name: Name;
  /** What was typed, which is `into`'s name. */
  to: string;
  /** Who already holds that name, and how much rests on them. */
  into: Name;
};

/**
 * One name, editable in place.
 *
 * Typing a name another already holds is how two are folded together, so there
 * is nothing else to press: the field is the whole interface.
 */
const Entry: FC<{
  name: Name;
  /** The names this one resembles, which are elsewhere in the same list. */
  near: Name[];
  /** Bumped to put every field back to the name it is stored under. */
  revert: number;
  onRename: (name: Name, to: string) => Promise<void>;
}> = ({ name, near, revert, onRename }) => {
  const t = useTranslations("vocabulary");
  const [value, setValue] = useState(name.name);
  const [saving, setSaving] = useState(false);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => setValue(name.name), [name.name, revert]);

  // Offering the other spelling writes it into the field rather than renaming
  // there and then. A fold cannot be undone, so the last press is the person's.
  function propose(other: Name) {
    setValue(other.name);
    field.current?.focus();
  }

  async function commit() {
    if (value.trim() === name.name || !value.trim()) {
      setValue(name.name);
      return;
    }

    setSaving(true);
    try {
      await onRename(name, value.trim());
    } finally {
      setSaving(false);
    }
  }

  return (
    <li
      className="py-2 px-3 rounded border border-gray-200 data-[doubtful=true]:border-amber-300 data-[doubtful=true]:bg-amber-50"
      data-doubtful={near.length > 0}
    >
      <div className="flex gap-3 items-center">
        <span className="grow">
          <TextInput
            bordered
            inputRef={field}
            value={value}
            onChange={setValue}
            aria-label={t("nameOf", { name: name.name })}
            disabled={saving}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") setValue(name.name);
            }}
          />
        </span>
        <span className="text-xs text-gray-600 shrink-0 tabular-nums w-28 text-right">
          {t("onPublications", { count: name.publications })}
        </span>
      </div>

      {near.length > 0 && (
        <p className="flex flex-wrap gap-1.5 items-baseline pt-2 text-xs text-amber-900">
          {t("alsoSpelt")}
          {near.map((other) => (
            <button
              key={other.id}
              type="button"
              className="py-0.5 px-2 bg-white rounded-full border border-amber-300 hover:bg-amber-100"
              onClick={() => propose(other)}
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

/** What the database would refuse, said plainly enough to act on. */
const Clash: FC<{ publications: Clashing[]; onDismiss: () => void }> = ({
  publications,
  onDismiss,
}) => {
  const t = useTranslations("vocabulary");

  return (
    <div
      role="alert"
      className="p-4 space-y-2 rounded-lg border border-red-300 bg-red-50"
    >
      <p className="text-sm font-medium text-red-800">{t("collides")}</p>
      <p className="text-sm text-red-700">{t("collidesDetail")}</p>
      <ul className="text-sm text-red-800 list-disc list-inside">
        {publications.map((publication) => (
          <li key={publication.id}>
            {publication.title} ({publication.year})
          </li>
        ))}
      </ul>
      <Button
        label={t("dismiss")}
        variant="outline"
        width="fit"
        size="small"
        onClick={onDismiss}
      />
    </div>
  );
};

/**
 * The names publications are built from — their translators, their original
 * authors, their publishers — and the one thing that can be done to them.
 *
 * These are typed, so they drift: "Penguin books" beside "Penguin Books",
 * "Alfred A.Knopf" beside "Alfred A. Knopf". Renaming corrects a spelling, and
 * renaming onto a name already taken folds the two together — one verb for
 * both, because a person deciding "these are the same" says so by writing the
 * name they should share.
 *
 * Sorted by name, so the spellings of one thing sit together. Where sorting is
 * not enough — a typo early in a name sorts far from what it meant — each name
 * carries the others it resembles, and those can be shown on their own.
 */
const VocabularyList: FC<{
  /** How the names are read. Defaults to asking the server. */
  read?: (kind: Kind) => Promise<Name[]>;
  /** How one is renamed. Defaults to asking the server. */
  write?: typeof rename;
}> = ({ read = list, write = rename }) => {
  const t = useTranslations("vocabulary");

  const [kind, setKind] = useState<Kind>("publishers");
  const [names, setNames] = useState<Name[] | null>(null);
  const [filter, setFilter] = useState("");
  const [onlyDoubtful, setOnlyDoubtful] = useState(false);
  const [collides, setCollides] = useState<Clashing[] | null>(null);
  const [asking, setAsking] = useState<Fold | null>(null);
  const [folding, setFolding] = useState(false);
  const [reverts, setReverts] = useState(0);

  const load = useCallback(
    (which: Kind) => {
      setNames(null);
      read(which).then(setNames);
    },
    [read],
  );

  useEffect(() => load(kind), [kind, load]);

  async function handleRename(name: Name, to: string, fold = false) {
    const answer = await write(kind, name.id, to, fold);

    if ("folds" in answer) {
      setAsking({ name, to, into: answer.folds });
      return;
    }

    setAsking(null);

    if ("collides" in answer) {
      setCollides(answer.collides);
      return;
    }

    setCollides(null);
    notify({
      message:
        answer.outcome === "merged"
          ? "vocabulary.merged"
          : "vocabulary.renamed",
      values: { from: name.name, to },
      level: "success",
    });

    load(kind);
  }

  // Only one field can be mid-edit — committing happens on leaving one — so
  // putting them all back puts back the one the question was about.
  function cancelFold() {
    setAsking(null);
    setReverts(reverts + 1);
  }

  async function confirmFold() {
    if (!asking) return;

    setFolding(true);
    try {
      await handleRename(asking.name, asking.to, true);
    } finally {
      setFolding(false);
    }
  }

  const all = names ?? [];
  const byId = new Map(all.map((name) => [name.id, name]));
  const doubtful = all.filter((name) => name.resembles.length > 0);

  const shown = all
    .filter((name) => !onlyDoubtful || name.resembles.length > 0)
    .filter((name) =>
      name.name.toLowerCase().includes(filter.trim().toLowerCase()),
    );

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex gap-1" role="group" aria-label={t("title")}>
          {KINDS.map((which) => (
            <Button
              key={which}
              label={t(which)}
              variant={which === kind ? "primary" : "outline"}
              width="fit"
              size="small"
              aria-pressed={which === kind}
              onClick={() => setKind(which)}
            />
          ))}
        </div>

        <label className="flex flex-col gap-1 text-sm min-w-64 grow">
          <span className="text-gray-600">{t("filterLabel")}</span>
          <TextInput
            bordered
            value={filter}
            onChange={setFilter}
            aria-label={t("filterLabel")}
            placeholder={t("filterPlaceholder")}
          />
        </label>
      </div>

      {doubtful.length > 0 && (
        <Button
          label={t("onlyDoubtful", { count: doubtful.length })}
          variant={onlyDoubtful ? "primary" : "outline"}
          width="fit"
          size="small"
          aria-pressed={onlyDoubtful}
          onClick={() => setOnlyDoubtful(!onlyDoubtful)}
        />
      )}

      {collides && (
        <Clash publications={collides} onDismiss={() => setCollides(null)} />
      )}

      <ConfirmationModal
        isOpen={asking !== null}
        title={t("foldTitle")}
        message={t("foldMessage", {
          from: asking?.name.name ?? "",
          into: asking?.into.name ?? "",
          moving: asking?.name.publications ?? 0,
          held: asking?.into.publications ?? 0,
        })}
        confirmLabel={t("foldConfirm")}
        loading={folding}
        onConfirm={confirmFold}
        onCancel={cancelFold}
      />

      {names === null ? (
        <p className="text-sm text-gray-600">{t("loading")}</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-gray-600">{t("none")}</p>
      ) : (
        <ul aria-label={t(kind)} className="space-y-1">
          {shown.map((name) => (
            <Entry
              key={name.id}
              name={name}
              revert={reverts}
              near={name.resembles
                .map((id) => byId.get(id))
                .filter((other) => other !== undefined)}
              onRename={handleRename}
            />
          ))}
        </ul>
      )}
    </div>
  );
};

export default VocabularyList;
