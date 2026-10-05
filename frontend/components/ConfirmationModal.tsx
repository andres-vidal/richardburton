"use client";

import { FC, ReactNode } from "react";
import Button from "./Button";
import { Modal } from "./Modal";

interface Props {
  isOpen: boolean;
  /** Accessible name and heading for the dialog. */
  title: string;
  /** What is about to happen and what it affects. */
  message: string;
  /** More detail on what the action affects, shown below the message. */
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Shown on the confirm button while the action is in flight. */
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A guard in front of a destructive action: names what is about to happen and
 * requires an explicit confirmation. The confirm button is the danger variant
 * and reflects the in-flight state; cancelling (button, overlay, or ESC) backs
 * out without consequence.
 */
const ConfirmationModal: FC<Props> = ({
  isOpen,
  title,
  message,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loading = false,
  onConfirm,
  onCancel,
}) => (
  <Modal isOpen={isOpen} onClose={onCancel} label={title}>
    <div className="flex flex-col gap-5 p-8 w-full">
      <h1 className="text-2xl font-normal">{title}</h1>
      <p className="text-gray-700">{message}</p>
      {children}
      <div className="flex gap-3 justify-end">
        <Button
          label={cancelLabel}
          variant="outline"
          width="fit"
          size="medium"
          onClick={onCancel}
        />
        <Button
          label={confirmLabel}
          variant="danger"
          width="fit"
          size="medium"
          loading={loading}
          onClick={onConfirm}
        />
      </div>
    </div>
  </Modal>
);

export default ConfirmationModal;
export type { Props as ConfirmationModalProps };
