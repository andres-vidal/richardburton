"use client";

import { useLanguage } from "modules/publication/hooks";
import {
  byLanguage,
  otherLanguage,
  type Language,
} from "modules/publication/model";
import {
  blockTexts,
  isBlank,
  withBlockTexts,
  type RichTextValue,
} from "modules/rich-text";
import { useTranslations } from "next-intl";
import { FC, useState } from "react";
import DraftButton from "./DraftButton";
import LanguageTabs from "./LanguageTabs";
import LazyRichTextArea from "./LazyRichTextArea";

/**
 * Edits a publication's notes in each language, in a panel of its own (see
 * `LanguageTabs`): one tab for each language where there is little room, and
 * the two side by side where there is enough. Each panel holds a
 * `LazyRichTextArea` named for the notes in its language, with `hint` under
 * its label, and the error in `errors` for its language under the text. A tab
 * whose notes have an error is shown in red, and a tab with no notes says it
 * is empty. The tab of the reader's language is selected at first.
 *
 * `value` holds the notes in each language, or null in a language there are
 * none in. An edit passes the language and the edited notes to `onChange`.
 * The component keeps no notes of its own.
 *
 * At the top of each panel, a `DraftButton` drafts the notes of that panel
 * from the notes in the other language. It asks before it replaces notes the
 * panel already has. The draft has the blocks of
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
  const [selected, setSelected] = useState(useLanguage());

  return (
    <LanguageTabs
      label={t("languages")}
      selected={selected}
      onSelect={setSelected}
      errors={errors}
      empty={byLanguage((language) => isBlank(value[language]))}
      actions={(language) => {
        const source = otherLanguage(language);

        return (
          <DraftButton
            label={t("draftFrom", { language: source })}
            from={source}
            to={language}
            texts={blockTexts(value[source])}
            replacing={
              isBlank(value[language])
                ? undefined
                : {
                    title: t("replaceTitle", { language }),
                    message: t("replaceMessage"),
                  }
            }
            onDrafted={(texts) =>
              onDraft(language, withBlockTexts(value[source], texts))
            }
          />
        );
      }}
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
