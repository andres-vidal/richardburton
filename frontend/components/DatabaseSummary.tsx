"use client";

import { Link } from "i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { FC } from "react";

/** The two views of the database, each with its path. */
const VIEWS = { list: "/", insights: "/insights" } as const;

type View = keyof typeof VIEWS;

type Props = {
  /** The number of publications, or of search results, as text. */
  summary: string;
  /** The current view. Its link is marked with `aria-current="page"`. */
  view: View;
};

/**
 * The line at the top of the database pages. It shows the number of
 * publications, or of search results, and links to the two views of the
 * database. The list view shows the publications, and the insights view shows
 * counts about them.
 *
 * Each link keeps the `search` parameter from the current URL, so switching
 * views keeps the same search.
 */
const DatabaseSummary: FC<Props> = ({ summary, view }) => {
  const t = useTranslations("views");
  const search = useSearchParams()?.get("search");
  const query = search ? `?search=${encodeURIComponent(search)}` : "";

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-indigo-700">
      <span className="flex items-center gap-3 grow">
        <span className="border-b grow h-fit" />
        <span>{summary}</span>
        <span className="border-b grow h-fit" />
      </span>
      <nav aria-label={t("label")}>
        <ul className="flex gap-1">
          {(Object.keys(VIEWS) as View[]).map((each) => (
            <li key={each}>
              <Link
                href={`${VIEWS[each]}${query}`}
                aria-current={each === view ? "page" : undefined}
                className="block px-2 py-0.5 rounded transition-colors hover:bg-indigo-100 focus-ring aria-[current=page]:text-white aria-[current=page]:bg-indigo-600"
              >
                {t(each)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};

export default DatabaseSummary;
export type { View };
