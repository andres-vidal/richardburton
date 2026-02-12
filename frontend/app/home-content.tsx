"use client";

import AddIcon from "assets/add.svg";
import Button from "components/Button";
import { ContactModal } from "components/ContactModal";
import { Counter } from "components/Counter";
import Layout from "components/Layout";
import { LearnMoreModal } from "components/LearnMoreModal";
import { useURLQueryModal } from "components/Modal";
import PublicationDownload from "components/PublicationDownload";
import PublicationHiddenAttributes from "components/PublicationHiddenAttributes";
import { PublicationIndexList } from "components/PublicationIndexList";
import { PublicationIndexTable } from "components/PublicationIndexTable";
import {
  PUBLICATION_MODAL_KEY,
  PublicationModal,
} from "components/PublicationModal";
import PublicationSearch from "components/PublicationSearch";
import SignInButton from "components/SignInButton";
import SignOutButton from "components/SignOutButton";
import { isString } from "lodash";
import { Publication } from "modules/publication";
import { User } from "modules/users";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function HomeContent() {
  const index = Publication.REMOTE.useIndex();
  const reset = Publication.STORE.useResetAll();
  const isAuthenticated = User.useIsAuthenticated();
  const count = Publication.STORE.useIndexCount() || 0;

  const searchParams = useSearchParams();
  const search = searchParams.get("search");

  useEffect(() => reset(), [reset]);

  useEffect(() => {
    index({ search: isString(search) ? search : undefined });
  }, [reset, index, search]);

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
      leftAside={<PublicationHiddenAttributes />}
      subheader={
        <div className="py-4 space-y-4">
          <div className="flex items-center justify-center gap-3 text-sm text-indigo-700">
            <span className="border-b grow h-fit" />
            <span>
              <Counter value={count} /> publications registered so far
            </span>
            <span className="border-b grow h-fit" />
          </div>
          <div className="pr-3 md:pr-0">
            <PublicationSearch />
          </div>
        </div>
      }
      footer={
        <div className="flex flex-col justify-center gap-2 sm:justify-start sm:flex-row sm:items-start">
          {isAuthenticated ? (
            <div className="flex gap-2">
              <PublicationDownload />
              <Link href="/publications/new">
                <Button
                  label="Add publications"
                  variant="outline"
                  Icon={AddIcon}
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
