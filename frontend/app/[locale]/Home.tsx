"use client";

import DashboardIcon from "assets/dashboard.svg";
import Button from "components/Button";
import ColumnMenu from "components/ColumnMenu";
import { ContactModal } from "components/ContactModal";
import Layout from "components/Layout";
import { LearnMoreModal } from "components/LearnMoreModal";
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
import { receiveIndex } from "modules/publication/store";
import type { PublicationId } from "modules/publication/model";
import {
  PublicationStoreProvider,
  usePublicationStore,
} from "modules/publication/workspace";
import { useIsAuthenticated } from "modules/session";
import { Link } from "i18n/navigation";
import { useRouter } from "i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

type Props = {
  /** The database for the current query, read on the server. */
  index: PublicationIndex;
};

export default function Home({ index }: Props) {
  return (
    <PublicationStoreProvider
      initialize={(store) => receiveIndex(store, index)}
    >
      <Database index={index} />
    </PublicationStoreProvider>
  );
}

function Database({ index }: Props) {
  const router = useRouter();
  const search = useSearchParams()?.get("search") ?? undefined;
  const t = useTranslations("home");
  const store = usePublicationStore();
  const isAuthenticated = useIsAuthenticated();
  const count = usePublicationIndexCount() || 0;
  const matching = useMatchingCount();

  const received = useRef(index);

  useEffect(() => {
    if (received.current === index) return;
    received.current = index;
    receiveIndex(store, index);
  }, [store, index]);

  function handleRowClick(id: PublicationId) {
    const query = new URLSearchParams({ modal: "" });
    if (search) query.set("search", search);

    return () => router.push(`/publications/${id}?${query}`);
  }

  const rowHref = (id: PublicationId) => `/publications/${id}`;

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
          <div className="flex items-center justify-center gap-3 text-sm text-indigo-700">
            <span className="border-b grow h-fit" />
            <span>
              {search
                ? t("matching", { count: matching })
                : t("count", { count })}
            </span>
            <span className="border-b grow h-fit" />
          </div>
          <div className="flex gap-2 items-start pr-3 md:pr-0">
            <div className="grow min-w-0">
              <PublicationSearch />
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

          <ContactModal />
          <LearnMoreModal />
          <SearchHelpModal />
        </div>
      }
    />
  );
}
