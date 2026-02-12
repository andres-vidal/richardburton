import { isString } from "lodash";
import { Publication } from "modules/publication";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChangeEventHandler, FC, useEffect, useState } from "react";

const PublicationSearch: FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const keywords = Publication.STORE.useKeywords();
  const [search, setSearch] = useState("");

  useEffect(() => {
    const searchUrlParam = searchParams.get("search") || "";
    setSearch((search) => {
      return isString(searchUrlParam) ? searchUrlParam : search;
    });
  }, [searchParams]);

  const handleChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    setSearch(e.target.value);

    const params = new URLSearchParams();
    if (e.target.value) {
      params.set("search", e.target.value);
    }
    router.replace(`?${params.toString()}`);
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
      <div className="h-4 px-2 space-x-1 text-xs truncate">
        {keywords && keywords.length > 0 && <span>Showing results for</span>}
        {keywords?.map((keyword, index) => (
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
      </div>
    </section>
  );
};

export default PublicationSearch;
