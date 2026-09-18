"use client";

import { useMatched } from "modules/publication/hooks";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

const PublicationSearch: FC = () => {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const matched = useMatched();
  const [isNavigating, startTransition] = useTransition();

  const searchUrlParam = searchParams?.get("search") ?? "";
  const [search, setSearch] = useState(searchUrlParam);
  const [previousParam, setPreviousParam] = useState(searchUrlParam);

  const requested = useRef(searchUrlParam);

  if (searchUrlParam !== previousParam) {
    setPreviousParam(searchUrlParam);
    if (searchUrlParam !== requested.current) {
      requested.current = searchUrlParam;
      setSearch(searchUrlParam);
    }
  }

  const navigate = useDebounce((value: string) => {
    requested.current = value;

    if (window.location.pathname !== pathname) return;

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
        placeholder="Browse data about Brazilian literature in translation"
        aria-label="Search publications"
        value={search}
        onChange={handleChange}
      />
      <div className="flex gap-3 items-baseline px-3 h-4 text-xs">
        <div aria-live="polite" className="space-x-1 truncate grow">
          {isLoading ? (
            <span>
              Searching the collection
              <span aria-hidden className="tracking-widest">
                <span className="animate-pulse">.</span>
                <span className="animate-pulse [animation-delay:150ms]">.</span>
                <span className="animate-pulse [animation-delay:300ms]">.</span>
              </span>
            </span>
          ) : (
            matched &&
            matched.length > 0 && (
              // Only the words the index read differently from the way they
              // were typed: told that `machado` was searched as `machado`, a
              // reader has learnt nothing. This says where the results came
              // from when they answer a term nobody typed.
              <>
                {matched.map(({ field, typed, words }, entry) => (
                  <span key={`search-matched-${field ?? "free"}-${typed}`}>
                    {entry > 0 && <span className="text-gray-400"> · </span>}
                    <strong className="font-normal">
                      {searchFor(field, typed)}
                    </strong>
                    <span> matched </span>
                    {words.map((word, index) => (
                      <span key={`search-matched-${typed}-${word}`}>
                        <Link
                          href={`?search=${encodeURIComponent(searchFor(field, word))}`}
                          className="text-indigo-600 underline hover:bg-indigo-300"
                        >
                          {word}
                        </Link>
                        {index < words.length - 1 && ", "}
                      </span>
                    ))}
                  </span>
                ))}
              </>
            )
          )}
        </div>
        <button
          type="button"
          onClick={() => openHelp()}
          className="text-gray-600 whitespace-nowrap rounded underline shrink-0 hover:text-indigo-600 focus-ring"
        >
          How to search
        </button>
      </div>
    </section>
  );
};

export default PublicationSearch;
