"use client";

import { useLocale } from "next-intl";
import { useCallback } from "react";

import { usePathname, useRouter } from "../i18n/navigation";
import Select, { SelectOption } from "./Select";

const languageOptions: SelectOption[] = [
  {
    id: "pt",
    label: "🇧🇷",
  },
  {
    id: "en",
    label: "🇺🇸",
  },
];

export default function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const currentLanguage =
    languageOptions.find((option) => option.id === locale) ??
    languageOptions[0];

  const getOptions = useCallback(async (search: string) => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return languageOptions;
    }

    return languageOptions.filter((option) =>
      option.label.toLowerCase().includes(normalizedSearch),
    );
  }, []);

  function handleLanguageChange(option: SelectOption) {
    if (option.id === locale) {
      return;
    }

    router.replace(pathname, {
      locale: option.id as "pt" | "en",
    });
  }

  return (
    <div className="w-8 shrink-0">
      <Select
        hideToggleButton
        aria-label="Select language"
        error=""
        value={currentLanguage}
        getOptions={getOptions}
        onChange={handleLanguageChange}
      />
    </div>
  );
}