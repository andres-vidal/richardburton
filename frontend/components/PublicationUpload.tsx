import UploadIcon from "assets/upload.svg";
import { Publication, ValidationResult } from "modules/publication";
import { ChangeEvent, FC, useRef, useState } from "react";
import Button from "./Button";
import Tooltip from "./Tooltip";

const PublicationUpload: FC = () => {
  const { useResetAll, useTotalCount } = Publication.STORE;
  const { useRequest } = Publication.REMOTE;

  const resetPublications = useResetAll();
  const totalPublications = useTotalCount();

  const [key, setKey] = useState(1);

  const handleChange = useRequest(
    ({ store: s }, http) =>
      async (event: ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
          const [file] = event.target.files;
          const payload = new FormData();
          payload.append("csv", file);

          try {
            resetPublications();
            const { data } = await http.post<ValidationResult[]>(
              "publications/validate",
              payload,
            );
            const entries = data.map((p, index) => ({ ...p, id: index }));
            Publication.STORE.with(s).setPublications(entries);
            Publication.STORE.with(s).setErrors(entries);
          } catch (error: unknown) {
            event.target.files = null;
            setKey((key) => -key);
            throw error;
          }
        }
      },
  );

  const message = totalPublications > 0 ? "Current data will be replaced!" : "";

  const input = useRef<HTMLInputElement>(null);

  return (
    <>
      <Tooltip warning message={message} placement="top">
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
