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
import { usePublicationIndexCount } from "modules/publication/hooks";
import { usePublicationIndex } from "modules/publication/remote";
import { resetAll } from "modules/publication/store";
import { useIsAuthenticated } from "modules/session";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const index = usePublicationIndex();
  const isAuthenticated = useIsAuthenticated();
  const count = usePublicationIndexCount() || 0;

  const searchParams = useSearchParams();
  const search = searchParams?.get("search") ?? undefined;

  useEffect(() => resetAll(), []);

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
          <PublicationModal />
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
