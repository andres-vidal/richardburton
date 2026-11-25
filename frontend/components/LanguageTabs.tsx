"use client";

import {
  LANGUAGES,
  otherLanguage,
  type Language,
} from "modules/publication/model";
import { useTranslations } from "next-intl";
import { FC, KeyboardEvent, ReactNode, useId, useRef } from "react";

/**
 * A tab for each language, Português and English, and a panel for each. The
 * tabs form a tab list named `label`, and each panel is named by its tab.
 * `children` renders the content of the panel of a language. Both panels stay
 * mounted, so a field in a panel that does not show keeps its state.
 *
 * In a container narrower than 48rem, only the selected panel shows.
 * `selected` is the language whose tab is selected, and `onSelect` receives a
 * language when its tab is pressed, or reached with the arrow keys, Home or
 * End. Only the selected tab is in the tab order.
 *
 * In a container of 48rem or wider, the tabs are hidden and the two panels
 * show side by side, Português first, each under the name of its language, so
 * the text in one language can be read while the other is written.
 *
 * A language set in `empty` has nothing written in it, and its tab says so,
 * in a mark after its name that is the tab's description, so that what is
 * missing in a language is known without opening its tab. The mark keeps its
 * room in a tab that does not show it, so the tabs do not move when a
 * language stops being empty, which can happen while a tab is being pressed. A
 * language with an error in `errors` has its tab, and its name above its
 * panel, shown in red, whether or not it is selected, so an error in a panel
 * that does not show is not missed.
 *
 * `actions` renders what acts on the panel of a language, such as a button
 * that fills it. It is shown at the top of that panel, at the end of the row.
 */
const LanguageTabs: FC<{
  label: string;
  selected: Language;
  onSelect: (language: Language) => void;
  errors?: Partial<Record<Language, string>>;
  empty?: Partial<Record<Language, boolean>>;
  actions?: (language: Language) => ReactNode;
  children: (language: Language) => ReactNode;
}> = ({
  label,
  selected,
  onSelect,
  errors = {},
  empty = {},
  actions,
  children,
}) => {
  const t = useTranslations("language");
  const id = useId();
  const tabs = useRef<Partial<Record<Language, HTMLButtonElement | null>>>({});

  const tabId = (language: Language) => `${id}-tab-${language}`;
  const panelId = (language: Language) => `${id}-panel-${language}`;
  const markId = (language: Language) => `${id}-mark-${language}`;

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
    <div className="@container">
      <div className="flex flex-col gap-3">
        <div
          role="tablist"
          aria-label={label}
          onKeyDown={handleKeyDown}
          className="flex gap-1 border-b border-gray-200 @3xl:hidden"
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
              aria-describedby={empty[language] ? markId(language) : undefined}
              tabIndex={language === selected ? 0 : -1}
              data-state={tabState(language)}
              onClick={() => onSelect(language)}
              className="flex gap-1.5 items-baseline px-3 py-1.5 -mb-px text-sm border-b-2 transition-colors focus-ring data-[state=idle]:border-transparent data-[state=idle]:text-gray-600 data-[state=idle]:hover:text-gray-900 data-[state=selected]:border-indigo-500 data-[state=selected]:text-indigo-700 data-[state=invalid]:border-transparent data-[state=invalid]:text-red-700 data-[state=invalid]:hover:text-red-900 data-[state=selected-invalid]:border-red-500 data-[state=selected-invalid]:text-red-700"
            >
              {t(language)}
              <span
                id={markId(language)}
                aria-hidden
                data-empty={Boolean(empty[language])}
                className="text-xs italic text-gray-600 data-[empty=false]:invisible"
              >
                {t("empty")}
              </span>
            </button>
          ))}
        </div>
        <div className="grid gap-3 @3xl:grid-cols-2 @3xl:gap-6">
          {LANGUAGES.map((language) => (
            <div
              key={language}
              role="tabpanel"
              id={panelId(language)}
              aria-labelledby={tabId(language)}
              data-selected={language === selected}
              className="flex-col gap-2 min-w-0 data-[selected=true]:flex data-[selected=false]:hidden @3xl:data-[selected=false]:flex"
            >
              <div
                data-actions={Boolean(actions)}
                className="flex-wrap gap-2 justify-between items-center data-[actions=true]:flex data-[actions=false]:hidden @3xl:data-[actions=false]:flex"
              >
                <span
                  aria-hidden
                  data-invalid={Boolean(errors[language])}
                  className="hidden text-sm font-medium text-gray-700 @3xl:block data-[invalid=true]:text-red-700"
                >
                  {t(language)}
                </span>
                {actions && <div className="ml-auto">{actions(language)}</div>}
              </div>
              {children(language)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LanguageTabs;
