"use client";

import Link from "next/link";
import { FC } from "react";

type Crumb = { label: string; href?: string };

/**
 * Location + back-nav for nested pages (e.g. the admin panel). Ancestors are
 * links; the current page is the plain last crumb.
 */
const Breadcrumb: FC<{ items: Crumb[] }> = ({ items }) => (
  <nav aria-label="Breadcrumb" className="px-1 pt-2 md:px-0">
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

export default Breadcrumb;
