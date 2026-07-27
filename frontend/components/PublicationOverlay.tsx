"use client";

import type { PublicationView } from "app/publications/read";
import { useRouter } from "next/navigation";
import { FC, Suspense, use } from "react";
import { Article } from "./Article";
import CopyLink from "./CopyLink";
import { Modal } from "./Modal";
import PublicationDetail, { PublicationHeading } from "./PublicationDetail";

const Loading: FC = () => (
  <div className="p-8 w-full text-gray-400">Loading…</div>
);

const Missing: FC = () => (
  <div className="p-8 w-full space-y-2">
    <h1 className="text-2xl font-normal">This publication is not here</h1>
    <p className="text-gray-700">
      It has been removed from the catalogue, or the link names a record that
      never existed.
    </p>
  </div>
);

const Opened: FC<{
  view: Promise<PublicationView | null>;
  onClose: () => void;
}> = ({ view, onClose }) => {
  const opened = use(view);

  return opened === null ? (
    <Missing />
  ) : (
    <Article
      heading={
        <>
          <PublicationHeading publication={opened.publication} />
          <CopyLink href={`/publications/${opened.publication.id}`} />
        </>
      }
      content={
        <PublicationDetail
          publication={opened.publication}
          history={opened.history}
          onNavigate={onClose}
          onDeleted={onClose}
        />
      }
    />
  );
};

/**
 * A publication read over the page the reader came from.
 *
 * Being its own route rather than a query on the catalogue's is what keeps it
 * cheap: opening it renders this and nothing else, so the rows underneath are
 * neither read again nor sent again. It closes by going back, because that is
 * what opening it did — the address it added is the publication's own, the same
 * one its page has and the same one the copy link hands out.
 *
 * The record streams in: the overlay opens on the click, and the dialog grows
 * into the record when it arrives.
 */
const PublicationOverlay: FC<{ view: Promise<PublicationView | null> }> = ({
  view,
}) => {
  const router = useRouter();

  return (
    <Modal isOpen onClose={router.back} label="Publication details">
      <Suspense fallback={<Loading />}>
        <Opened view={view} onClose={router.back} />
      </Suspense>
    </Modal>
  );
};

export default PublicationOverlay;
