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
 * End. Only the selected tab is in the tab order. A language marked in
 * `invalid` has its tab shown in red, so an error in the hidden panel is not
 * missed. `actions`, such as a button that acts on the selected panel, is
 * shown at the end of the row of tabs.
 */
const LanguageTabs: FC<{
  label: string;
  selected: Language;
  onSelect: (language: Language) => void;
  invalid?: Partial<Record<Language, boolean>>;
  actions?: ReactNode;
  children: (language: Language) => ReactNode;
}> = ({ label, selected, onSelect, invalid = {}, actions, children }) => {
  const t = useTranslations("language");
  const id = useId();
  const tabs = useRef<Partial<Record<Language, HTMLButtonElement | null>>>({});

  const tabId = (language: Language) => `${id}-tab-${language}`;
  const panelId = (language: Language) => `${id}-panel-${language}`;

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
              data-selected={language === selected}
              data-invalid={Boolean(invalid[language])}
              onClick={() => onSelect(language)}
              className="px-3 py-1.5 -mb-px text-sm border-b-2 transition-colors focus-ring data-[selected=false]:border-transparent data-[selected=false]:text-gray-600 data-[selected=false]:hover:text-gray-900 data-[selected=true]:border-indigo-500 data-[selected=true]:text-indigo-700 data-[invalid=true]:text-red-700"
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
