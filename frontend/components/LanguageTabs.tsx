"use client";

import {
  LANGUAGES,
  otherLanguage,
  type Language,
} from "modules/publication/model";
import { useTranslations } from "next-intl";
import { FC, KeyboardEvent, ReactNode, useId, useRef } from "react";

/**
 * A tab for each language, Português and English, and a panel for each, of
 * which only the selected one shows. The tabs form a tab list named `label`,
 * and each panel is named by its tab. `children` renders the content of the
 * panel of a language. Both panels stay mounted while the other one shows, so
 * a field in the hidden panel keeps its state.
 *
 * `selected` is the language whose tab is selected, and `onSelect` receives a
 * language when its tab is pressed, or reached with the arrow keys, Home or
 * End. Only the selected tab is in the tab order. A language with an error in
 * `errors` has its tab shown in red, whether or not it is selected, so an
 * error in the hidden panel is not missed. `actions`, such as a button that acts on the selected panel, is
 * shown at the end of the row of tabs.
 */
const LanguageTabs: FC<{
  label: string;
  selected: Language;
  onSelect: (language: Language) => void;
  errors?: Partial<Record<Language, string>>;
  actions?: ReactNode;
  children: (language: Language) => ReactNode;
}> = ({ label, selected, onSelect, errors = {}, actions, children }) => {
  const t = useTranslations("language");
  const id = useId();
  const tabs = useRef<Partial<Record<Language, HTMLButtonElement | null>>>({});

  const tabId = (language: Language) => `${id}-tab-${language}`;
  const panelId = (language: Language) => `${id}-panel-${language}`;

  // Returns the state a tab is styled by: whether it is selected, and whether
  // its language has an error.
  const tabState = (language: Language) =>
    language === selected
      ? errors[language]
        ? "selected-invalid"
        : "selected"
      : errors[language]
        ? "invalid"
        : "idle";

  // Selects the language a key moves to and focuses its tab. With two tabs,
  // each arrow moves to the other one, and Home and End go to the first and
  // the last.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target =
      event.key === "ArrowLeft" || event.key === "ArrowRight"
        ? otherLanguage(selected)
        : event.key === "Home"
          ? LANGUAGES[0]
          : event.key === "End"
            ? LANGUAGES[LANGUAGES.length - 1]
            : undefined;

    if (target) {
      event.preventDefault();
      onSelect(target);
      tabs.current[target]?.focus();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 justify-between items-end border-b border-gray-200">
        <div
          role="tablist"
          aria-label={label}
          onKeyDown={handleKeyDown}
          className="flex gap-1"
        >
          {LANGUAGES.map((language) => (
            <button
              key={language}
              ref={(element) => {
                tabs.current[language] = element;
              }}
              type="button"
              role="tab"
              id={tabId(language)}
              aria-selected={language === selected}
              aria-controls={panelId(language)}
              tabIndex={language === selected ? 0 : -1}
              data-state={tabState(language)}
              onClick={() => onSelect(language)}
              className="px-3 py-1.5 -mb-px text-sm border-b-2 transition-colors focus-ring data-[state=idle]:border-transparent data-[state=idle]:text-gray-600 data-[state=idle]:hover:text-gray-900 data-[state=selected]:border-indigo-500 data-[state=selected]:text-indigo-700 data-[state=invalid]:border-transparent data-[state=invalid]:text-red-700 data-[state=invalid]:hover:text-red-900 data-[state=selected-invalid]:border-red-500 data-[state=selected-invalid]:text-red-700"
            >
              {t(language)}
            </button>
          ))}
        </div>
        {actions && <div className="pb-1">{actions}</div>}
      </div>
      {LANGUAGES.map((language) => (
        <div
          key={language}
          role="tabpanel"
          id={panelId(language)}
          aria-labelledby={tabId(language)}
          hidden={language !== selected}
        >
          {children(language)}
        </div>
      ))}
    </div>
  );
};

export default LanguageTabs;
