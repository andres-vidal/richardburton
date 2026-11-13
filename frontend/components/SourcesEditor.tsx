"use client";

import { useLanguage } from "modules/publication/hooks";
import { otherLanguage, type Language } from "modules/publication/model";
import { useTranslations } from "next-intl";
import { FC, useState } from "react";
import Button from "./Button";
import DraftButton from "./DraftButton";
import LanguageTabs from "./LanguageTabs";
import TextInput from "./TextInput";

/** A small button with a symbol, for moving or removing one source. */
const RowButton: FC<{
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: string;
}> = ({ label, onClick, disabled, children }) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    disabled={disabled}
    className="shrink-0 px-2 py-1 text-gray-600 rounded transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:opacity-30 disabled:pointer-events-none"
  >
    {children}
  </button>
);

/**
 * Edits one language's sources, an ordered list of free text written in
 * `language`. `value` is the whole list, and adding, editing, removing or
 * moving an entry passes a new list to `onChange`. Moving an entry swaps it
 * with its neighbour. An entry has no identity of its own, so each row is
 * keyed by its position, and moving an entry swaps the contents of two rows.
 */
const SourceList: FC<{
  language: Language;
  value: string[];
  onChange: (sources: string[]) => void;
}> = ({ language, value, onChange }) => {
  const t = useTranslations("admin");
  const setAt = (index: number, content: string) =>
    onChange(value.map((entry, i) => (i === index ? content : entry)));

  const removeAt = (index: number) =>
    onChange(value.filter((_, i) => i !== index));

  const add = () => onChange([...value, ""]);

  const move = (index: number, delta: number) => {
    const target = index + delta;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      {value.length === 0 ? (
        <p className="text-sm italic text-gray-500">{t("noSources")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {value.map((content, index) => (
            <li key={index} className="flex gap-1 items-center">
              <TextInput
                bordered
                fill
                lang={language}
                value={content}
                onChange={(next) => setAt(index, next)}
                aria-label={t("sourceNumber", { number: index + 1 })}
                placeholder={t("sourcePlaceholder")}
              />
              <RowButton
                label={t("moveSourceUp", { number: index + 1 })}
                onClick={() => move(index, -1)}
                disabled={index === 0}
              >
                ↑
              </RowButton>
              <RowButton
                label={t("moveSourceDown", { number: index + 1 })}
                onClick={() => move(index, 1)}
                disabled={index === value.length - 1}
              >
                ↓
              </RowButton>
              <RowButton
                label={t("removeSource", { number: index + 1 })}
                onClick={() => removeAt(index)}
              >
                ✕
              </RowButton>
            </li>
          ))}
        </ul>
      )}

      <div>
        <Button
          label={t("addSource")}
          variant="outline"
          width="fit"
          size="small"
          onClick={add}
        />
      </div>
    </div>
  );
};

/**
 * Edits a publication's sources in each language. Each language's sources are
 * an ordered list of free text of their own, in a tab of their own (see
 * `LanguageTabs`). The two lists are independent: adding, editing, removing or
 * moving a source in one tab leaves the other tab's list as it is. The tab of
 * the reader's language is selected at first, and only the selected tab's
 * list is rendered, so the inputs of the two lists never share a name.
 *
 * `value` holds the list of each language. An edit passes the language and its
 * whole new list to `onChange`. The component keeps no sources of its own.
 *
 * Beside the tabs, a `DraftButton` drafts, in a browser that can translate,
 * the selected tab's list from the other language's list: each source of that
 * list that is not blank, translated, in the same order. It asks before it
 * replaces sources the tab already has. After a draft, the tab says to check
 * the titles in the drafted sources.
 *
 * `errors` holds what is wrong with the list of each language. Each error is
 * shown under its tab's list, and a tab whose list has an error is shown in
 * red.
 */
const SourcesEditor: FC<{
  value: Record<Language, string[]>;
  onChange: (language: Language, sources: string[]) => void;
  errors?: Partial<Record<Language, string>>;
}> = ({ value, onChange, errors = {} }) => {
  const t = useTranslations("admin");
  const draft = useTranslations("draft");
  const attribute = useTranslations("attributes");
  const [selected, setSelected] = useState(useLanguage());
  // The language of the last draft, whose tab asks to check the titles.
  const [drafted, setDrafted] = useState<Language | null>(null);
  const from = otherLanguage(selected);
  // The sources a draft translates: the other language's, without blank ones.
  const drafting = value[from].filter((source) => source.trim() !== "");

  function fill(sources: string[]) {
    onChange(selected, sources);
    setDrafted(selected);
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm text-gray-600">{attribute("sources")}</span>
        <span className="text-xs text-gray-500">{t("sourcesHint")}</span>
      </div>

      <LanguageTabs
        label={t("sourcesLanguages")}
        selected={selected}
        onSelect={setSelected}
        errors={errors}
        actions={
          <DraftButton
            key={selected}
            label={t("draftSourcesFrom", { language: from })}
            from={from}
            to={selected}
            texts={drafting}
            replacing={
              value[selected].length === 0
                ? undefined
                : {
                    title: t("replaceSourcesTitle", { language: selected }),
                    message: t("replaceSourcesMessage"),
                  }
            }
            onDrafted={fill}
          />
        }
      >
        {(language) =>
          language === selected ? (
            <div className="flex flex-col gap-2">
              <SourceList
                language={language}
                value={value[language]}
                onChange={(next) => onChange(language, next)}
              />
              {drafted === language && (
                <p role="status" className="text-xs text-amber-700">
                  {draft("checkTitles")}
                </p>
              )}
              {errors[language] && (
                <p className="text-xs text-red-600">{errors[language]}</p>
              )}
            </div>
          ) : null
        }
      </LanguageTabs>
    </section>
  );
};

export default SourcesEditor;
