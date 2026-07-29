"use client";

import type { PublicationView } from "app/publications/read";
import { useRouter } from "next/navigation";
import { FC, Suspense, use } from "react";
import { Article } from "./Article";
import CopyLink from "./CopyLink";
import { Modal } from "./Modal";
import PublicationDetail, { PublicationHeading } from "./PublicationDetail";

/**
 * Where the record will be, in the shape it will take.
 *
 * The dialog is sized by what is in it, and a height the content decides cannot
 * be transitioned — so instead of animating the growth there is little to grow
 * from: the dialog barely moves when the record replaces this.
 */
const Loading: FC = () => (
  <div role="status" aria-label="Loading" className="p-8 w-full">
    <div aria-hidden className="space-y-6 animate-pulse">
      <div className="flex gap-3 items-center">
        <div className="w-2/5 h-7 bg-gray-200 rounded" />
        <div className="w-24 h-5 bg-gray-100 rounded" />
      </div>
      <div className="space-y-2">
        <div className="w-full h-4 bg-gray-200 rounded" />
        <div className="w-11/12 h-4 bg-gray-200 rounded" />
        <div className="w-2/3 h-4 bg-gray-200 rounded" />
      </div>
      <div className="space-y-2">
        <div className="w-28 h-3 bg-gray-100 rounded" />
        <ul className="space-y-1.5">
          <li className="flex gap-2.5 items-baseline">
            <span className="size-1.5 rounded-full shrink-0 bg-gray-200" />
            <span className="w-4/5 h-4 bg-gray-200 rounded" />
          </li>
          <li className="flex gap-2.5 items-baseline">
            <span className="size-1.5 rounded-full shrink-0 bg-gray-200" />
            <span className="w-3/5 h-4 bg-gray-200 rounded" />
          </li>
        </ul>
      </div>
    </div>
  </div>
);

const Missing: FC = () => (
  <div className="p-8 w-full space-y-2">
    <h1 className="text-2xl font-normal">This publication is not here</h1>
    <p className="text-gray-700">
      It has been removed from the database, or the link names a record that
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
 * Being its own route rather than a query on the database's is what keeps it
 * cheap: opening it renders this and nothing else, so the rows underneath are
 * neither read again nor sent again. The address it adds is the publication's
 * own — the same one its page has, and the one the copy link hands out.
 *
 * The record streams in, so the overlay opens on the click and holds the
 * record's place until it lands.
 */
const PublicationOverlay: FC<{
  view: Promise<PublicationView | null>;
  /**
   * Where closing goes when there is nothing to go back to — a reader who
   * reloaded, or arrived at this address directly. Followed from the database,
   * closing is going back, and this is left out.
   */
  closeTo?: string;
}> = ({ view, closeTo }) => {
  const router = useRouter();

  const close = closeTo ? () => router.push(closeTo) : router.back;

  return (
    <Modal isOpen onClose={close} label="Publication details">
      <Suspense fallback={<Loading />}>
        <Opened view={view} onClose={close} />
      </Suspense>
    </Modal>
  );
};

export default PublicationOverlay;
