"use client";

import { Link } from "i18n/navigation";
import { useTranslations } from "next-intl";
import { FC } from "react";

/** One step of the path: a link when it has an `href`, plain text otherwise. */
type Crumb = { label: string; href?: string };

/**
 * Renders the path from the home page to the current page as a navigation
 * landmark. Each crumb with an `href` is a link. The last crumb, which names
 * the current page, has none, and is marked as the current page.
 */
const Breadcrumb: FC<{ items: Crumb[] }> = ({ items }) => {
  const t = useTranslations("common");

  return (
    <nav aria-label={t("breadcrumb")} className="px-1 pt-2 md:px-0">
      <ol className="flex flex-wrap gap-1.5 items-center text-sm">
        {items.map(({ label, href }, index) => (
          <li key={label} className="flex gap-1.5 items-center">
            {index > 0 && (
              <span aria-hidden className="text-gray-400">
                /
              </span>
            )}
            {href ? (
              <Link href={href} className="anchor">
                {label}
              </Link>
            ) : (
              <span aria-current="page" className="text-gray-700">
                {label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumb;
