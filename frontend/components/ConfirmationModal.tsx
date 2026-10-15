"use client";

import { useTranslations } from "next-intl";
import { FC, ReactNode } from "react";
import Button from "./Button";
import { Modal } from "./Modal";

interface Props {
  isOpen: boolean;
  /** The heading of the dialog, which also names it. */
  title: string;
  /** What is about to happen and what it affects. */
  message: string;
  /** More detail on what the action affects, shown below the message. */
  children?: ReactNode;
  /** The label of the confirm button, naming the action: "Delete". */
  confirmLabel: string;
  /** Shows the confirm button as loading while the action is in flight. */
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A dialog that asks for confirmation before a destructive action. It shows
 * `title` as its heading, then `message` and `children`, then a Cancel button
 * and a confirm button in the danger variant.
 *
 * The confirm button calls `onConfirm`. The Cancel button, a press on the
 * overlay and Escape call `onCancel`.
 */
const ConfirmationModal: FC<Props> = ({
  isOpen,
  title,
  message,
  children,
  confirmLabel,
  loading = false,
  onConfirm,
  onCancel,
}) => {
  const t = useTranslations("common");

  return (
    <Modal isOpen={isOpen} onClose={onCancel} heading={title}>
      <p className="text-gray-700">{message}</p>
      {children}
      <div className="flex gap-3 justify-end">
        <Button
          label={t("cancel")}
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
    </Modal>
  );
};

export default ConfirmationModal;
export type { Props as ConfirmationModalProps };
