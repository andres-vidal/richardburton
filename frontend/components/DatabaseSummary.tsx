"use client";

import { Link } from "i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { FC } from "react";

/** The ways of reading the database, and where each is. */
const VIEWS = { list: "/", insights: "/insights" } as const;

type View = keyof typeof VIEWS;

type Props = {
  /** How many publications there are, or how many a search found, in words. */
  summary: string;
  /** The view this summary heads. */
  view: View;
};

/**
 * The line that heads the database: how many publications it holds or a search
 * found, and links to the two ways of reading them. The list shows the
 * publications themselves, and the insights count what they hold.
 *
 * Each link carries the search in the address, so changing views keeps
 * reading the same publications.
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
