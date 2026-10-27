"use client";

import {
  emptySource,
  isBlankText,
  otherLanguage,
  type Language,
  type Source,
} from "modules/publication/model";
import { useLocale, useTranslations } from "next-intl";
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
 * Edits a publication's sources, an ordered list in which each source has a
 * text in each language. `value` is the whole list, and adding, editing,
 * removing or moving a source passes a new list to `onChange`. The component
 * keeps no sources of its own. Moving a source swaps it with its neighbour. A
 * source has no identity of its own, so each row is keyed by its position, and
 * moving a source swaps the contents of two rows.
 *
 * The list is shown in a tab for each language (see `LanguageTabs`), and only
 * the selected tab's panel is rendered. Both tabs list the same sources in the
 * same order, each with its text in the tab's language, and adding, removing
 * or moving a source does so in both. A source
 * with no text in the tab's language shows its text in the other language as
 * the placeholder. Emptying a text leaves the source without text in that
 * language. The tab of the reader's language is selected at first.
 *
 * Beside the tabs, a `DraftButton` drafts, in a browser that can translate,
 * the text of each source that has none in the selected tab's language from
 * its text in the other language. It leaves the sources that have text alone.
 * After a draft, the tab says to check the titles in the drafted sources.
 *
 * `error`, such as sources that a file could not pair across the two
 * languages, is shown under the list.
 */
const SourcesEditor: FC<{
  value: Source[];
  onChange: (sources: Source[]) => void;
  error?: string;
}> = ({ value, onChange, error }) => {
  const t = useTranslations("admin");
  const draft = useTranslations("draft");
  const attribute = useTranslations("attributes");
  const locale = useLocale() as Language;
  const [selected, setSelected] = useState(locale);
  // The language of the last draft, whose tab asks to check the titles.
  const [drafted, setDrafted] = useState<Language | null>(null);
  const from = otherLanguage(selected);

  const setAt = (index: number, language: Language, text: string) =>
    onChange(
      value.map((source, i) =>
        i === index
          ? { ...source, [language]: text === "" ? null : text }
          : source,
      ),
    );

  const removeAt = (index: number) =>
    onChange(value.filter((_, i) => i !== index));

  const add = () => onChange([...value, emptySource()]);

  const move = (index: number, delta: number) => {
    const target = index + delta;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  // The positions of the sources a draft fills: those with no text in the
  // selected language and some text in the other one.
  const drafting = value.flatMap((source, index) =>
    isBlankText(source[selected]) && !isBlankText(source[from]) ? [index] : [],
  );

  function fill(texts: string[]) {
    onChange(
      value.map((source, index) => {
        const at = drafting.indexOf(index);
        return at < 0 ? source : { ...source, [selected]: texts[at] };
      }),
    );
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
        actions={
          <DraftButton
            key={selected}
            label={t("draftSourcesFrom", { language: from })}
            from={from}
            to={selected}
            texts={drafting.map((index) => value[index][from] ?? "")}
            onDrafted={fill}
          />
        }
      >
        {(language) =>
          language !== selected ? null : value.length === 0 ? (
            <p className="text-sm italic text-gray-500">{t("noSources")}</p>
          ) : (
            <div className="flex flex-col gap-2">
              <ul className="flex flex-col gap-2">
                {value.map((source, index) => (
                  <li key={index} className="flex gap-1 items-center">
                    <TextInput
                      bordered
                      fill
                      lang={language}
                      value={source[language] ?? ""}
                      onChange={(next) => setAt(index, language, next)}
                      aria-label={t("sourceNumber", { number: index + 1 })}
                      placeholder={
                        isBlankText(source[otherLanguage(language)])
                          ? t("sourcePlaceholder")
                          : source[otherLanguage(language)]!
                      }
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
              {drafted === language && (
                <p role="status" className="text-xs text-amber-700">
                  {draft("checkTitles")}
                </p>
              )}
            </div>
          )
        }
      </LanguageTabs>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div>
        <Button
          label={t("addSource")}
          variant="outline"
          width="fit"
          size="small"
          onClick={add}
        />
      </div>
    </section>
  );
};

export default SourcesEditor;
