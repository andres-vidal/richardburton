"use client";

import type { PublicationView } from "app/publications/read";
import { usePathname, useRouter } from "i18n/navigation";
import { PublicationStoreProvider } from "modules/publication/workspace";
import { useTranslations } from "next-intl";
import { FC, Suspense, use } from "react";
import { Article } from "./Article";
import CopyLink from "./CopyLink";
import EditModal from "./EditModal";
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
            <li className="flex gap-2.5 items-center">
              <span className="size-1.5 rounded-full shrink-0 bg-gray-200" />
              <span className="w-4/5 h-4 bg-gray-200 rounded" />
            </li>
            <li className="flex gap-2.5 items-center">
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
          kind={opened.kind}
          follows={opened.follows}
          history={opened.history}
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
 *
 * The overlay gives the view a publication store of its own, and its modal is
 * an `EditModal`. Closing the overlay while the view's edit form holds an
 * unsaved edit therefore asks first whether to discard it. The view drops the
 * edit as it closes.
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
  const t = useTranslations("publication");
  const router = useRouter();
  const pathname = usePathname();

  const close = closeTo ? () => router.push(closeTo) : router.back;

  // A parallel route slot keeps rendering its last content even after the URL
  // navigates away, so a link inside the overlay would leave the overlay open
  // over the new page. Gate on the URL instead: show it only while the path is
  // still a publication's.
  return pathname.startsWith("/publications/") ? (
    <PublicationStoreProvider>
      <EditModal isOpen onClose={close} label={t("details")}>
        <Suspense fallback={<Loading />}>
          <Opened view={view} onClose={close} />
        </Suspense>
      </EditModal>
    </PublicationStoreProvider>
  ) : null;
};

export default PublicationOverlay;
