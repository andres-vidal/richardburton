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

/** A rename that would fold, waiting for the person to confirm or cancel it. */
type Fold = {
  /** The name being renamed. */
  name: Name;
  /** The new name that was typed, which is `into`'s name. */
  to: string;
  /** The name that already has `to`, with its publication count. */
  into: Name;
};

/**
 * One name in a text field. Pressing Enter or leaving the field sends the
 * rename when the value has changed and is not blank. Escape puts the stored
 * name back.
 *
 * Typing a name that another entry already has asks to fold the two, so the
 * entry has no separate merge button.
 */
const Entry: FC<{
  name: Name;
  /** The names this one resembles, taken from the same list. */
  near: Name[];
  /** Incremented to reset the field to the stored name. */
  revert: number;
  onRename: (name: Name, to: string) => Promise<void>;
}> = ({ name, near, revert, onRename }) => {
  const t = useTranslations("vocabulary");
  const [value, setValue] = useState(name.name);
  const [saving, setSaving] = useState(false);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => setValue(name.name), [name.name, revert]);

  // Writes the other spelling into the field and focuses it, without renaming.
  // The rename is sent only when the person commits the field, because a fold
  // cannot be undone.
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

/** An alert listing the publications a rename would give the same identity. */
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
 * Lists the author or publisher names that publications are built from, and
 * lets the person rename them.
 *
 * Names are typed by hand, so one name can be stored under two spellings, such
 * as "Penguin books" and "Penguin Books". Renaming to a free name corrects the
 * spelling. Renaming to a name that is already taken folds the two into one,
 * after the person confirms.
 *
 * The list is sorted by name and can be filtered by text. Each name also lists
 * the other names it resembles, and a toggle shows only the names that
 * resemble another.
 */
const VocabularyList: FC<{
  /** Loads the names of a kind. Defaults to `list`. */
  read?: (kind: Kind) => Promise<Name[]>;
  /** Renames a name. Defaults to `rename`. */
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

  // Resets every field to its stored name. A field commits when it loses
  // focus, so only one field can hold unsaved text, and that is the field the
  // fold was for.
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
