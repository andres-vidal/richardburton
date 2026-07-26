"use client";

import type { PublicationView } from "app/publications/read";
import { FC, Suspense, use } from "react";
import { Article } from "./Article";
import CopyLink from "./CopyLink";
import { Modal, useURLQueryModal } from "./Modal";
import PublicationDetail, { PublicationHeading } from "./PublicationDetail";

const PUBLICATION_MODAL_KEY = "publication";

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
 * A publication read over the index, addressed by the URL so the view survives
 * a reload and can be linked to.
 *
 * The record is read on the server from the address itself, not taken from the
 * index behind it — so a link to a publication outside the current search opens
 * it all the same, and the mutation log arrives with it rather than after a
 * click. The view is `PublicationDetail`, the same one the publication's own
 * page renders; all this adds is the overlay and the address to copy, since the
 * URL bar is still showing the catalogue underneath.
 *
 * The overlay opens on the URL alone and the record streams into it, so a click
 * is answered at once instead of waiting on the server.
 */
const PublicationModal: FC<{ view?: Promise<PublicationView | null> }> = ({
  view,
}) => {
  const modal = useURLQueryModal(PUBLICATION_MODAL_KEY);

  return (
    <Modal
      isOpen={modal.isOpen}
      onClose={modal.close}
      label="Publication details"
    >
      {view ? (
        <Suspense fallback={<Loading />}>
          <Opened view={view} onClose={modal.close} />
        </Suspense>
      ) : (
        <Loading />
      )}
    </Modal>
  );
};

export { PUBLICATION_MODAL_KEY, PublicationModal };
