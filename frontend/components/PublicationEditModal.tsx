/**
 * TODO:
 * - autocomplete no funciona en PublicationInput y si funciona
 *   en TablePublicationInput. Puede ser que se muestre atras del modal.
 */
import { useState, FormEvent } from "react";
import { useRouter } from "next/router";
import { http } from "app";
import { isAxiosError } from "axios";
import { Publication } from "modules/publication";
import { Article } from "./Article";
import { Modal, useURLQueryModal } from "./Modal";
import Button from "./Button";
import PublicationInput from "./PublicationInput";
import { useNotify } from "./Notifications";

const PUBLICATION_EDIT_MODAL_KEY = "edit";

const usePublicationEditModal = () =>
  useURLQueryModal(PUBLICATION_EDIT_MODAL_KEY);

const { usePublication, useSetPublication } = Publication.STORE;

interface PublicationEditFormProps {
  rowId: number;
  publication: Publication;
  onClose: () => void;
}

const PublicationEditForm = ({
  rowId,
  publication: originalPublication,
  onClose,
}: PublicationEditFormProps) => {
  const [publication, setPublication] = useState(originalPublication);
  const [errors, setErrors] = useState({} as Record<keyof Publication, string>);
  const [loading, setLoading] = useState(false);

  const setStorePublication = useSetPublication();
  const notify = useNotify();

  const handleChange = (key: string) => (value: string) => {
    setPublication({ ...originalPublication, [key]: value });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setLoading(true);
      const res = await http.put(`/publications/${publication.id}`, publication);

      if (res.status == 200) {
        setStorePublication(rowId, publication);
        onClose();
      }
    } catch(err) {
      if (isAxiosError(err) && err.response && err.response.status === 400) {
        setErrors(err.response.data.errors);
      } else {
        notify({ message: "Publication edition failed", level: "error" });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="p-2 flex flex-col space-y-6" onSubmit={handleSubmit}>
      {Publication.ATTRIBUTES.map((attribute) => (
        <PublicationInput
          key={attribute}
          label={Publication.ATTRIBUTE_LABELS[attribute]}
          attribute={attribute}
          value={publication[attribute]}
          onChange={handleChange(attribute)}
          error={errors[attribute]}
          autoValidated
        />
      ))}
      <div className="mt-6 flex flex-row justify-between">
        <Button
          variant="secondary"
          width="fixed"
          onClick={onClose}
          label="Cancel"
        />
        <Button variant="primary" width="fixed" type="submit" label="Submit" loading={loading} />
      </div>
    </form>
  );
};

const PublicationEditModal = () => {
  const { isOpen, close } = usePublicationEditModal();
  const { query } = useRouter();
  const rawPublicationId = query["publication"];
  const publicationId =
    rawPublicationId !== undefined
      ? parseInt(rawPublicationId as string)
      : undefined;

  const publication = usePublication(publicationId as number);

  const handleClose = () => close();

  return (
    <Modal isOpen={isOpen} onClose={close}>
      <Article
        heading={<>Edit Publication</>}
        content={
          publication ? (
            <PublicationEditForm
              rowId={publicationId as number}
              publication={publication as Publication}
              onClose={handleClose}
            />
          ) : (
            <div className="flex flex-col items-center">
              <p className="p-4">Publication not found</p>
              <Button
                variant="secondary"
                width="fixed"
                onClick={handleClose}
                label="Close"
              />
            </div>
          )
        }
      />
    </Modal>
  );
};

export { PublicationEditModal, usePublicationEditModal };
