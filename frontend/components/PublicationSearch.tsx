"use client";

import { useIsIndexLoading, useKeywords } from "modules/publication/hooks";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChangeEventHandler, FC, useState } from "react";

const PublicationSearch: FC = () => {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const keywords = useKeywords();
  const isLoading = useIsIndexLoading();

  const searchUrlParam = searchParams?.get("search") ?? "";
  const [search, setSearch] = useState(searchUrlParam);
  const [previousParam, setPreviousParam] = useState(searchUrlParam);

  if (searchUrlParam !== previousParam) {
    setPreviousParam(searchUrlParam);
    if (searchUrlParam) setSearch(searchUrlParam);
  }

  const handleChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    setSearch(e.target.value);

    router.replace(
      e.target.value
        ? `${pathname}?search=${encodeURIComponent(e.target.value)}`
        : pathname,
    );
  };

  return (
    <section className="space-y-3">
      <input
        className="w-full p-2 bg-gray-100 border border-gray-200 rounded outline-none placeholder:text-sm focus:bg-gray-active hover:bg-gray-active"
        placeholder="Browse data about Brazilian literature in translation"
        aria-label="Search publications"
        value={search}
        onChange={handleChange}
      />
      <div aria-live="polite" className="h-4 px-2 space-x-1 text-xs truncate">
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
