"use client";

import { useMatchingCount, usePerPage } from "modules/publication/hooks";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FC, useTransition } from "react";
import Button from "./Button";

/**
 * Which page of the results is being read, and the way to the ones either side.
 *
 * A page is a place: it is in the address, so it can be linked, reloaded and
 * gone back to. Moving between pages is a navigation like the search is, and
 * the rows arrive with it rather than after it.
 *
 * How many a page holds is the server's to say, so the count of pages is read
 * from what it reported rather than from a number kept in step by hand.
 */
const PublicationPages: FC = () => {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const [isNavigating, startTransition] = useTransition();

  const matching = useMatchingCount();
  const perPage = usePerPage();

  const page = Number(searchParams?.get("page")) || 1;
  const pages = perPage > 0 ? Math.max(Math.ceil(matching / perPage), 1) : 1;

  function go(to: number) {
    const next = new URLSearchParams(searchParams?.toString());

    if (to <= 1) next.delete("page");
    else next.set("page", String(to));

    const query = next.toString();

    startTransition(() =>
      router.push(query ? `${pathname}?${query}` : pathname),
    );
  }

  return pages > 1 ? (
    <nav
      aria-label="Pages"
      className="flex gap-3 justify-center items-center py-2 text-sm text-gray-600"
    >
      <Button
        label="Previous"
        variant="outline"
        width="fit"
        size="field"
        disabled={page <= 1 || isNavigating}
        onClick={() => go(page - 1)}
      />
      <span aria-live="polite">
        Page {page} of {pages}
      </span>
      <Button
        label="Next"
        variant="outline"
        width="fit"
        size="field"
        disabled={page >= pages || isNavigating}
        onClick={() => go(page + 1)}
      />
    </nav>
  ) : null;
};

export default PublicationPages;
