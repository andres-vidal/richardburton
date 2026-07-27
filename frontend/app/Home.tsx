"use client";

import DashboardIcon from "assets/dashboard.svg";
import Button from "components/Button";
import ColumnMenu from "components/ColumnMenu";
import { ContactModal } from "components/ContactModal";
import Layout from "components/Layout";
import { LearnMoreModal } from "components/LearnMoreModal";
import { useURLQueryModal } from "components/Modal";
import PublicationDownload from "components/PublicationDownload";
import { PublicationIndexList } from "components/PublicationIndexList";
import { PublicationIndexTable } from "components/PublicationIndexTable";
import {
  PUBLICATION_MODAL_KEY,
  PublicationModal,
} from "components/PublicationModal";
import PublicationSearch from "components/PublicationSearch";
import SignInButton from "components/SignInButton";
import SignOutButton from "components/SignOutButton";
import type { PublicationView } from "app/publications/read";
import { usePublicationIndexCount } from "modules/publication/hooks";
import { usePublicationIndex } from "modules/publication/remote";
import { PublicationStoreProvider } from "modules/publication/workspace";
import { useIsAuthenticated } from "modules/session";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

type Props = {
  /** The publication the URL names, read on the server. Unawaited, so the
   * overlay can open before it arrives. */
  opened?: Promise<PublicationView | null>;
};

/**
 * The catalogue: the index and everything that acts on it — search, the column
 * menu, the counter, the export, and the overlay for one publication. They read
 * and write one working set, so the state they share is held here, around all of
 * them, rather than asked of whatever renders this.
 */
export default function Home(props: Props) {
  return (
    <PublicationStoreProvider>
      <Catalogue {...props} />
    </PublicationStoreProvider>
  );
}

function Catalogue({ opened }: Props) {
  const index = usePublicationIndex();
  const isAuthenticated = useIsAuthenticated();
  const count = usePublicationIndexCount() || 0;

  const searchParams = useSearchParams();
  const search = searchParams?.get("search") ?? undefined;

  useEffect(() => {
    index({ search });
  }, [index, search]);

  const modal = useURLQueryModal(PUBLICATION_MODAL_KEY);

  function handleRowClick(id: number) {
    return () => modal.open(`${id}`);
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
          <PublicationModal view={opened} />
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
