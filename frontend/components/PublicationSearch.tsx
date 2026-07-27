"use client";

import { useKeywords } from "modules/publication/hooks";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChangeEventHandler, FC, useRef, useState, useTransition } from "react";
import useDebounce from "utils/useDebounce";

/** Long enough that a typist does not query on every letter. */
const SEARCH_DELAY_MS = 350;

const PublicationSearch: FC = () => {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const keywords = useKeywords();
  const [isNavigating, startTransition] = useTransition();

  const searchUrlParam = searchParams?.get("search") ?? "";
  const [search, setSearch] = useState(searchUrlParam);
  const [previousParam, setPreviousParam] = useState(searchUrlParam);

  // The last query this input asked the URL for. What it types travels to the URL
  // and comes back, and typing does not stop while it is away: by the time
  // "mach" arrives, the input may read "machado". So it follows the URL only
  // when *someone else* changed it — a keyword link, the back button, a fresh
  // arrival — and never when the URL is only catching up with what was typed.
  const requested = useRef(searchUrlParam);

  if (searchUrlParam !== previousParam) {
    setPreviousParam(searchUrlParam);
    if (searchUrlParam !== requested.current) {
      requested.current = searchUrlParam;
      setSearch(searchUrlParam);
    }
  }

  // The query lives in the URL, and the results are read for it where the page is
  // rendered — so typing navigates rather than fetching. In a transition, so what
  // is on screen stays until the new rows are ready; debounced, so a typist does
  // not ask for a page per letter.
  const navigate = useDebounce((value: string) => {
    requested.current = value;
    startTransition(() => {
      router.replace(
        value ? `${pathname}?search=${encodeURIComponent(value)}` : pathname,
      );
    });
  }, SEARCH_DELAY_MS);

  // What is typed and what the URL says have not met yet, or they have and the
  // page is still coming: either way a search is in flight.
  const isLoading = search !== searchUrlParam || isNavigating;

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
      <div aria-live="polite" className="h-4 px-3 space-x-1 text-xs truncate">
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
          keywords &&
          keywords.length > 0 && (
            <>
              <span>Showing results for</span>
              {keywords.map((keyword, index) => (
                <span key={`search-keyword-${keyword}`}>
                  <Link
                    href={`?search=${keyword}`}
                    className="text-indigo-600 underline hover:bg-indigo-300"
                  >
                    {keyword}
                  </Link>
                  {index < keywords.length - 1 ? "," : "."}
                </span>
              ))}
            </>
          )
        )}
      </div>
    </section>
  );
};

export default PublicationSearch;
