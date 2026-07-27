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
import PublicationSearch from "components/PublicationSearch";
import SignInButton from "components/SignInButton";
import SignOutButton from "components/SignOutButton";
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
  /** The catalogue for the current query, read on the server. */
  index: PublicationIndex;
};

/**
 * The catalogue: the index and everything that acts on it — search, the column
 * menu, the counter, the export, and the overlay for one publication. They read
 * and write one working set, so the state they share is held here, around all of
 * them, rather than asked of whatever renders this.
 */
export default function Home({ index }: Props) {
  return (
    <PublicationStoreProvider
      initialize={(store) => receiveIndex(store, index)}
    >
      <Catalogue index={index} />
    </PublicationStoreProvider>
  );
}

function Catalogue({ index }: Props) {
  const router = useRouter();
  const search = useSearchParams()?.get("search") ?? undefined;
  const store = usePublicationStore();
  const isAuthenticated = useIsAuthenticated();
  const count = usePublicationIndexCount() || 0;

  // The store opened with the first read (see `initialize`); this carries the
  // ones after it — a new query, or a re-read after a change. Not a fetch: the
  // reading is done, and this is the store catching up with it.
  const received = useRef(index);

  useEffect(() => {
    if (received.current === index) return;
    received.current = index;
    receiveIndex(store, index);
  }, [store, index]);

  // A row goes to the publication's own address, asking for it *over* the
  // catalogue. Followed from here that is intercepted into an overlay; reloaded,
  // the address says what it was showing, and the page draws the same thing.
  // Without the mark it is simply the publication's page — what a shared link is.
  // The query goes with it, so a reload draws the catalogue the reader was
  // actually looking at, and closing returns to it.
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
              <SignOutButton />
            </div>
          ) : (
            <div className="hidden sm:block">
              <SignInButton />
            </div>
          )}

          <ContactModal />
          <LearnMoreModal />
        </div>
      }
    />
  );
}
