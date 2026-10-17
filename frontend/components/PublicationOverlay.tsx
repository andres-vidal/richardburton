"use client";

import type { PublicationView } from "app/publications/read";
import { usePathname, useRouter } from "i18n/navigation";
import { hasUnsavedEdit } from "modules/publication/store";
import {
  PublicationStoreProvider,
  usePublicationStore,
} from "modules/publication/workspace";
import { useTranslations } from "next-intl";
import { FC, ReactNode, Suspense, use } from "react";
import { Article } from "./Article";
import ConfirmationModal from "./ConfirmationModal";
import CopyLink from "./CopyLink";
import { Modal, useModal } from "./Modal";
import ModalHeading from "./ModalHeading";
import PublicationDetail, { PublicationHeading } from "./PublicationDetail";

/**
 * A placeholder in the shape of the record, shown while the record is read.
 *
 * The dialog is as tall as its content, and that height cannot be animated, so
 * the placeholder takes about the record's height and the dialog barely moves
 * when the record replaces it.
 */
const Loading: FC = () => {
  const t = useTranslations("common");

  return (
    <div role="status" aria-label={t("loading")} className="p-8 w-full">
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
};

/** Says that there is no publication at this address. */
const Missing: FC = () => {
  const t = useTranslations("publication");

  return (
    <div className="p-8 w-full">
      <ModalHeading heading={t("notHere")} subheading={t("notHereDetail")} />
    </div>
  );
};

/**
 * The record that `view` resolves to, as an article headed by its title and a
 * copy link, or `Missing` when it resolves to null. It suspends until `view`
 * resolves. `onClose` runs once the record is deleted.
 */
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
          onDeleted={onClose}
        />
      }
    />
  );
};

/**
 * The modal of the overlay, with `children` in it. Closing the modal, with
 * Escape, its close button or a press outside the dialog, calls `close`. When
 * the publication store has an unsaved edit (see `hasUnsavedEdit`), the modal
 * stays open instead, and a `ConfirmationModal` asks whether to discard the
 * edit. Discard calls `close`, and the edit is dropped as the view closes.
 * Cancel, and Escape in the confirmation, keep the edit as it was.
 */
const OverlayModal: FC<{ close: () => void; children: ReactNode }> = ({
  close,
  children,
}) => {
  const t = useTranslations("publication");
  const store = usePublicationStore();
  const discarding = useModal();

  function handleClose() {
    if (hasUnsavedEdit(store)) discarding.open();
    else close();
  }

  return (
    <Modal isOpen onClose={handleClose} label={t("details")}>
      {children}
      <ConfirmationModal
        isOpen={discarding.isOpen}
        title={t("discardTitle")}
        message={t("discardMessage")}
        confirmLabel={t("discard")}
        onConfirm={close}
        onCancel={discarding.close}
      />
    </Modal>
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
 *
 * The overlay gives the view a publication store of its own. Closing the
 * overlay while the view's edit form holds an unsaved edit asks first whether
 * to discard it (see `OverlayModal`).
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
  const pathname = usePathname();

  const close = closeTo ? () => router.push(closeTo) : router.back;

  // A parallel route slot keeps rendering its last content even after the URL
  // navigates away, so a link inside the overlay would leave the overlay open
  // over the new page. Gate on the URL instead: show it only while the path is
  // still a publication's.
  return pathname.startsWith("/publications/") ? (
    <PublicationStoreProvider>
      <OverlayModal close={close}>
        <Suspense fallback={<Loading />}>
          <Opened view={view} onClose={close} />
        </Suspense>
      </OverlayModal>
    </PublicationStoreProvider>
  ) : null;
};

export default PublicationOverlay;
