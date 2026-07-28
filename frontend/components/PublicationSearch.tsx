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
