"use client";

import UploadIcon from "assets/upload.svg";
import { upload, useTotalPublicationCount } from "modules/publication";
import { ChangeEvent, FC, useRef, useState } from "react";
import Button from "./Button";
import Tooltip from "./Tooltip";

const PublicationUpload: FC = () => {
  const totalPublications = useTotalPublicationCount();

  const [key, setKey] = useState(1);

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const [file] = event.target.files;
      const payload = new FormData();
      payload.append("csv", file);

      try {
        await upload(payload);
      } catch {
        // The remote layer already surfaced a notification; just reset the
        // input so the same file can be re-selected.
        event.target.files = null;
        setKey((key) => -key);
      }
    }
  };

  const message = totalPublications > 0 ? "Current data will be replaced!" : "";

  const input = useRef<HTMLInputElement>(null);

  return (
    <>
      <Tooltip variant="warning" message={message} placement="top">
        <Button
          label="Upload.csv"
          variant="outline"
          Icon={UploadIcon}
          alignment="left"
          width="fixed"
          onClick={() => input.current?.click()}
        />
      </Tooltip>
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
