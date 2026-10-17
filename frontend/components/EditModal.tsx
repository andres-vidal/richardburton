"use client";

import { hasUnsavedEdit } from "modules/publication/store";
import { usePublicationStore } from "modules/publication/workspace";
import { useTranslations } from "next-intl";
import { FC } from "react";
import ConfirmationModal from "./ConfirmationModal";
import { Modal, type ModalProps, useModal } from "./Modal";

/**
 * A `Modal` for editing publications in the enclosing publication store, which
 * asks before it closes on an unsaved edit. It takes the props of `Modal`.
 *
 * Closing the modal, with Escape, its close button or a press outside the
 * dialog, calls `onClose` at once, unless the store has an unsaved edit (see
 * `hasUnsavedEdit`). The modal then stays open, and a `ConfirmationModal` asks
 * whether to discard the edit. Discard calls `onClose`, which must drop the
 * edit, for instance by unmounting the store that holds it. Cancel, and Escape
 * or a press outside the confirmation, keep the edit as it was.
 */
const EditModal: FC<ModalProps> = (props) => {
  const t = useTranslations("publication");
  const store = usePublicationStore();
  const confirmation = useModal();

  function handleClose() {
    if (hasUnsavedEdit(store)) confirmation.open();
    else props.onClose();
  }

  return (
    <Modal {...props} onClose={handleClose}>
      {props.children}
      <ConfirmationModal
        isOpen={confirmation.isOpen}
        title={t("discardTitle")}
        message={t("discardMessage")}
        confirmLabel={t("discard")}
        onConfirm={props.onClose}
        onCancel={confirmation.close}
      />
    </Modal>
  );
};

export default EditModal;
