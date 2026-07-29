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
import PublicationPages from "components/PublicationPages";
import PublicationSearch from "components/PublicationSearch";
import SignInButton from "components/SignInButton";
import type { PublicationIndex } from "app/publications/read";
import { usePublicationIndexCount } from "modules/publication/hooks";
import { receiveIndex } from "modules/publication/store";
import {
  PublicationStoreProvider,
  usePublicationStore,
} from "modules/publication/workspace";
import { useIsAuthenticated } from "modules/session";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  const store = usePublicationStore();
  const isAuthenticated = useIsAuthenticated();
  const count = usePublicationIndexCount() || 0;

  const received = useRef(index);

  useEffect(() => {
    if (received.current === index) return;
    received.current = index;
    receiveIndex(store, index);
  }, [store, index]);

  function handleRowClick(id: number) {
    const query = new URLSearchParams({ modal: "" });
    if (search) query.set("search", search);

    return () => router.push(`/publications/${id}?${query}`);
  }

  return (
    <Layout
      content={
        <>
          <div className="hidden sm:block">
            <PublicationIndexTable onRowClick={handleRowClick} />
          </div>
          <div className="sm:hidden">
            <PublicationIndexList onItemClick={handleRowClick} />
          </div>
        </>
      }
      subheader={
        <div className="py-4 space-y-4">
          <div className="flex items-center justify-center gap-3 text-sm text-indigo-700">
            <span className="border-b grow h-fit" />
            <span>{count} publications registered so far</span>
            <span className="border-b grow h-fit" />
          </div>
          <div className="flex gap-2 items-start pr-3 md:pr-0">
            <div className="grow">
              <PublicationSearch />
            </div>
            <div className="hidden sm:block">
              <ColumnMenu />
            </div>
          </div>
        </div>
      }
      footer={
        <>
          {/* Above the rest of the footer, and inside it: the page controls sit
              at the foot of the results, where the footer would otherwise
              cover them. */}
          <PublicationPages />
          <div className="flex flex-col justify-center gap-2 sm:justify-start sm:flex-row sm:items-start">
            {isAuthenticated ? (
              <div className="flex gap-2">
                <PublicationDownload />
                <Link href="/admin">
                  <Button
                    label="Admin"
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
          </div>
        </>
      }
    />
  );
}
