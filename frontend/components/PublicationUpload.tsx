"use client";

import UploadIcon from "assets/upload.svg";
import { useTotalPublicationCount } from "modules/publication/hooks";
import { useDocumentHealth } from "modules/publication/presence";
import { usePublicationStore } from "modules/publication/workspace";
import { upload } from "modules/publication/remote";
import { useTranslations } from "next-intl";
import { ChangeEvent, FC, useRef, useState } from "react";
import Button from "./Button";
import ConfirmationModal from "./ConfirmationModal";
import Tooltip from "./Tooltip";

/**
 * Replace the working set from a CSV.
 *
 * An upload replaces everything, which in a shared document is everything
 * everybody has. That is worth asking about rather than warning about: a
 * tooltip is read after the fact by whoever caused it, and the work it would
 * discard belongs to people who are not looking at this button.
 */
const PublicationUpload: FC = () => {
  const t = useTranslations("admin");
  const store = usePublicationStore();
  const totalPublications = useTotalPublicationCount();

  // A document is the shared surface; the plain workspace is this person's own.
  const { connection } = useDocumentHealth();
  const shared = connection !== undefined;

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

  // Nothing to discard, or nobody else's work to discard: the question would be
  // asking somebody to confirm replacing what is only theirs and only here.
  const ask = () =>
    shared && totalPublications > 0 ? setAsking(true) : choose();

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
