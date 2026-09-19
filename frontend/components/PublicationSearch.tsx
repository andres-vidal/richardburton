"use client";

import { useMatched } from "modules/publication/hooks";
import type { Matched } from "modules/publication/model";
import { Link } from "i18n/navigation";
import { usePathname, useRouter } from "i18n/navigation";
import { useTranslations } from "next-intl";
import {
  usePathname as useAddressPathname,
  useSearchParams,
} from "next/navigation";
import { ChangeEventHandler, FC, useRef, useState, useTransition } from "react";
import useDebounce from "utils/useDebounce";
import { useURLQueryModal } from "./Modal";
import { SEARCH_HELP_MODAL_KEY } from "./SearchHelpModal";

/** Long enough that a typist does not query on every letter. */
const SEARCH_DELAY_MS = 350;

/**
 * A word written as the term that would find it on its own: scoped to the field
 * it was asked of, so following it narrows the same way rather than widening to
 * every field.
 */
function searchFor(field: string | null, word: string): string {
  return field ? `${field}:${word}` : word;
}

/** One typed word and what it matched, each match linking to a search for it. */
const SearchMatch: FC<Matched> = ({ field, typed, words }) => {
  const t = useTranslations("search");

  return (
    <>
      <strong className="font-normal">{searchFor(field, typed)}</strong>
      <span> {t("matched")} </span>
      {words.map((word, index) => (
        <span key={word}>
          <Link
            href={`?search=${encodeURIComponent(searchFor(field, word))}`}
            className="text-indigo-600 underline hover:bg-indigo-300"
          >
            {word}
          </Link>
          {index < words.length - 1 && ", "}
        </span>
      ))}
    </>
  );
};

/** Every match the current search made, separated by dots. Empty renders nothing. */
const SearchMatches: FC<{ matched: Matched[] }> = ({ matched }) => (
  <>
    {matched.map((match, index) => (
      <span key={`${match.field ?? "free"}-${match.typed}`}>
        {index > 0 && <span className="text-gray-400"> · </span>}
        <SearchMatch {...match} />
      </span>
    ))}
  </>
);

/** The animated ellipsis shown while a query is in flight. */
const SearchProgress: FC = () => {
  const t = useTranslations("search");

  return (
    <span>
      {t("searching")}
      <span aria-hidden className="tracking-widest">
        <span className="animate-pulse">.</span>
        <span className="animate-pulse [animation-delay:150ms]">.</span>
        <span className="animate-pulse [animation-delay:300ms]">.</span>
      </span>
    </span>
  );
};

const PublicationSearch: FC = () => {
  const t = useTranslations("search");
  const router = useRouter();
  const pathname = usePathname() ?? "";
  // The address as written, locale and all. `usePathname` above strips the
  // locale, which is right for building an href and wrong for asking whether the
  // reader is still on the page they typed into.
  const address = useAddressPathname();
  const searchParams = useSearchParams();
  const matched = useMatched();
  const [isNavigating, startTransition] = useTransition();

  const searchUrlParam = searchParams?.get("search") ?? "";
  const [search, setSearch] = useState(searchUrlParam);
  const [previousParam, setPreviousParam] = useState(searchUrlParam);
  const [expanded, setExpanded] = useState(false);

  const requested = useRef(searchUrlParam);

  if (searchUrlParam !== previousParam) {
    setPreviousParam(searchUrlParam);
    setExpanded(false);
    if (searchUrlParam !== requested.current) {
      requested.current = searchUrlParam;
      setSearch(searchUrlParam);
    }
  }

  const navigate = useDebounce((value: string) => {
    requested.current = value;

    if (window.location.pathname !== address) return;

    startTransition(() => {
      router.replace(
        value ? `${pathname}?search=${encodeURIComponent(value)}` : pathname,
      );
    });
  }, SEARCH_DELAY_MS);

  const isLoading = search !== searchUrlParam || isNavigating;

  // Opened from the URL, so the modal preserves the current search.
  const { open: openHelp } = useURLQueryModal(SEARCH_HELP_MODAL_KEY);

  const handleChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    setSearch(e.target.value);
    navigate(e.target.value);
  };

  return (
    <section className="space-y-3">
      <input
        className="w-full py-2 px-3 bg-white border border-gray-300 rounded outline-none transition-colors placeholder:text-sm focus:bg-gray-100 hover:bg-gray-100"
        placeholder={t("placeholder")}
        aria-label={t("ariaLabel")}
        value={search}
        onChange={handleChange}
      />
      <div className="flex gap-3 items-baseline px-3 min-h-4 text-xs">
        <div
          id="search-report"
          aria-live="polite"
          data-expanded={expanded}
          className="space-x-1 min-w-0 grow data-[expanded=false]:truncate"
        >
          {isLoading ? (
            <SearchProgress />
          ) : (
            <SearchMatches matched={matched ?? []} />
          )}
        </div>
        {matched && matched.length > 0 && (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls="search-report"
            onClick={() => setExpanded(!expanded)}
            className="text-gray-600 whitespace-nowrap rounded underline shrink-0 hover:text-indigo-600 focus-ring"
          >
            {expanded ? t("showLess") : t("showAll")}
          </button>
        )}
        <button
          type="button"
          onClick={() => openHelp()}
          className="text-gray-600 whitespace-nowrap rounded underline shrink-0 hover:text-indigo-600 focus-ring"
        >
          {t("howTo")}
        </button>
      </div>
    </section>
  );
};

export default PublicationSearch;
