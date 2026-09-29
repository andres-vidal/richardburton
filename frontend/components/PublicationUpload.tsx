"use client";

import UploadIcon from "assets/upload.svg";
import { useTotalPublicationCount } from "modules/publication/hooks";
import { usePublicationStore } from "modules/publication/workspace";
import { upload } from "modules/publication/remote";
import { useTranslations } from "next-intl";
import { ChangeEvent, FC, useRef, useState } from "react";
import Button from "./Button";
import ConfirmationModal from "./ConfirmationModal";
import Tooltip from "./Tooltip";

/**
 * Replaces the working set with the rows of a CSV file.
 *
 * When the workspace already has rows, the button opens a `ConfirmationModal`
 * that says how many rows will be discarded, and the file picker opens only
 * after the person confirms. When the workspace is empty, the file picker opens
 * straight away.
 *
 * The workspace is a shared document, so an upload also discards rows that
 * other people added. That is why it asks first instead of relying on the
 * warning tooltip.
 */
const PublicationUpload: FC = () => {
  const t = useTranslations("admin");
  const store = usePublicationStore();
  const totalPublications = useTotalPublicationCount();

  const [key, setKey] = useState(1);
  const [asking, setAsking] = useState(false);

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const [file] = event.target.files;
      const payload = new FormData();
      payload.append("csv", file);

      try {
        await upload(store, payload);
      } catch {
        // The remote layer already surfaced a notification; just reset the
        // input so the same file can be re-selected.
        event.target.files = null;
        setKey((key) => -key);
      }
    }
  };

  const message = totalPublications > 0 ? t("dataWillBeReplaced") : "";

  const input = useRef<HTMLInputElement>(null);

  const choose = () => input.current?.click();

  // Asks for confirmation when there are rows to discard, and otherwise opens
  // the file picker straight away.
  const ask = () => (totalPublications > 0 ? setAsking(true) : choose());

  return (
    <>
      <Tooltip variant="warning" message={message} placement="top">
        <Button
          label={t("upload")}
          variant="outline"
          Icon={UploadIcon}
          alignment="left"
          width="fixed"
          onClick={ask}
        />
      </Tooltip>

      <ConfirmationModal
        isOpen={asking}
        title={t("replaceTitle")}
        message={t("replaceMessage", { count: totalPublications })}
        confirmLabel={t("replaceConfirm")}
        cancelLabel={t("replaceCancel")}
        onConfirm={() => {
          setAsking(false);
          choose();
        }}
        onCancel={() => setAsking(false)}
      />
      <input
        ref={input}
        key={key}
        type="file"
        id="upload-csv"
        className="hidden"
        onChange={handleChange}
      />
    </>
  );
};

export default PublicationUpload;
