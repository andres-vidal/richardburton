"use client";

import DashboardIcon from "assets/dashboard.svg";
import Button from "components/Button";
import ColumnMenu from "components/ColumnMenu";
import DatabaseSummary from "components/DatabaseSummary";
import Layout from "components/Layout";
import PublicationDownload from "components/PublicationDownload";
import { PublicationIndexList } from "components/PublicationIndexList";
import { PublicationIndexTable } from "components/PublicationIndexTable";
import PublicationScroll from "components/PublicationScroll";
import PublicationSearch from "components/PublicationSearch";
import { SearchHelpModal } from "components/SearchHelpModal";
import SignInButton from "components/SignInButton";
import type { PublicationIndex } from "app/publications/read";
import {
  useMatchingCount,
  usePublicationIndexCount,
} from "modules/publication/hooks";
import { searchHref, type PublicationId } from "modules/publication/model";
import { PublicationStoreProvider } from "modules/publication/workspace";
import { useIsAuthenticated } from "modules/session";
import { Link, useRouter } from "i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback } from "react";

type Props = {
  /** The database for the current query, read on the server. */
  index: PublicationIndex;
};

/** Returns the address of the publication `id`'s own page. */
const rowHref = (id: PublicationId) => `/publications/${id}`;

/**
 * The front page: the database for the current search, in a table on wide
 * screens and a list on narrow ones, with the search field above it.
 *
 * The page has a publication store of its own, which holds `index` and takes
 * each new `index` the server renders for a new search.
 */
export default function Home({ index }: Props) {
  return (
    <PublicationStoreProvider index={index}>
      <Database index={index} />
    </PublicationStoreProvider>
  );
}

/**
 * The front page inside its store. A click on a row opens the publication over
 * the database, keeping the search.
 */
function Database({ index }: Props) {
  const router = useRouter();
  const search = useSearchParams()?.get("search") ?? undefined;
  const t = useTranslations("home");
  const isAuthenticated = useIsAuthenticated();
  const count = usePublicationIndexCount() || 0;
  const matching = useMatchingCount();

  const handleRowClick = useCallback(
    (id: PublicationId) =>
      router.push(searchHref(search, rowHref(id), { modal: "" })),
    [router, search],
  );

  return (
    <Layout
      content={
        <>
          <div className="hidden sm:block">
            <PublicationIndexTable
              onRowClick={handleRowClick}
              rowHref={rowHref}
            />
          </div>
          <div className="sm:hidden">
            <PublicationIndexList
              onItemClick={handleRowClick}
              itemHref={rowHref}
            />
          </div>
          <PublicationScroll />
        </>
      }
      subheader={
        <div className="py-4 space-y-4">
          <DatabaseSummary view="list" count={search ? matching : count} />
          <div className="flex gap-2 items-start pr-3 md:pr-0">
            <div className="grow min-w-0">
              <PublicationSearch matched={index.matched} />
            </div>
            <div className="hidden sm:block">
              <ColumnMenu />
            </div>
          </div>
        </div>
      }
      footer={
        <div className="flex flex-col justify-center gap-2 sm:justify-start sm:flex-row sm:items-start">
          {isAuthenticated ? (
            <div className="flex gap-2">
              <PublicationDownload />
              <Link href="/admin">
                <Button
                  label={t("admin")}
                  variant="outline"
                  Icon={DashboardIcon}
                  alignment="left"
                  width="fixed"
                />
              </Link>
            </div>
          ) : (
            <div className="hidden sm:block">
              <SignInButton />
            </div>
          )}

          <SearchHelpModal />
        </div>
      }
    />
  );
}
