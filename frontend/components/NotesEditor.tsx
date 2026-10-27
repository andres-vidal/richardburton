"use client";

import { otherLanguage, type Language } from "modules/publication/model";
import {
  blockTexts,
  isBlank,
  withBlockTexts,
  type RichTextValue,
} from "modules/rich-text";
import { useLocale, useTranslations } from "next-intl";
import { FC, useState } from "react";
import DraftButton from "./DraftButton";
import LanguageTabs from "./LanguageTabs";
import LazyRichTextArea from "./LazyRichTextArea";

/**
 * Edits a publication's notes in each language, in a tab of its own (see
 * `LanguageTabs`). Each tab holds a `LazyRichTextArea` named for the notes in
 * its language, with `hint` under its label, and the error in `errors` for its
 * language under the text. A tab whose notes have an error is shown in red.
 * The tab of the reader's language is selected at first.
 *
 * `value` holds the notes in each language, or null in a language there are
 * none in. An edit passes the language and the edited notes to `onChange`.
 * The component keeps no notes of its own.
 *
 * Beside the tabs, a `DraftButton` drafts the notes of the selected tab from
 * the notes in the other language, in a browser that can translate. It asks
 * before it replaces notes the tab already has. The draft has the blocks of
 * the other language's notes, each with its text translated (see
 * `withBlockTexts`), and goes to `onDraft`, or to `onChange` when there is no
 * `onDraft`.
 */
const NotesEditor: FC<{
  value: Record<Language, RichTextValue | null>;
  onChange: (language: Language, value: RichTextValue | null) => void;
  onDraft?: (language: Language, value: RichTextValue) => void;
  errors?: Partial<Record<Language, string>>;
  hint?: string;
}> = ({ value, onChange, onDraft = onChange, errors = {}, hint }) => {
  const t = useTranslations("notes");
  const locale = useLocale() as Language;
  const [selected, setSelected] = useState(locale);
  const source = otherLanguage(selected);

  return (
    <LanguageTabs
      label={t("languages")}
      selected={selected}
      onSelect={setSelected}
      invalid={{ pt: Boolean(errors.pt), en: Boolean(errors.en) }}
      actions={
        <DraftButton
          key={selected}
          label={t("draftFrom", { language: source })}
          from={source}
          to={selected}
          texts={blockTexts(value[source])}
          replacing={
            isBlank(value[selected])
              ? undefined
              : {
                  title: t("replaceTitle", { language: selected }),
                  message: t("replaceMessage"),
                  confirmLabel: t("replace"),
                }
          }
          onDrafted={(texts) =>
            onDraft(selected, withBlockTexts(value[source], texts))
          }
        />
      }
    >
      {(language) => (
        <LazyRichTextArea
          label={t("field", { language })}
          hint={hint ?? t("hint")}
          placeholder={t("placeholder")}
          value={value[language]}
          error={errors[language]}
          onChange={(next) => onChange(language, next)}
        />
      )}
    </LanguageTabs>
  );
};

export default NotesEditor;
