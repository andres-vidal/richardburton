import { useState } from "react";
import { useRouter } from "next/router";
import { Publication, PublicationId } from "modules/publication";
import { Article } from "./Article";
import { Modal, useURLQueryModal } from "./Modal";
import Button from "./Button";
import PublicationInput from "./PublicationInput";

const PUBLICATION_EDIT_MODAL_KEY = "edit";
const usePublicationEditModal = () =>
  useURLQueryModal(PUBLICATION_EDIT_MODAL_KEY);

const { usePublication } = Publication.STORE;

interface PublicationEditFormProps {
  publicationId: PublicationId;
  publication: Publication;
  onClose: () => void;
}

const PublicationEditForm = ({
  publicationId,
  publication: originalPublication,
  onClose,
}: PublicationEditFormProps) => {
  const [publication, setPublication] = useState(originalPublication);

  const handleChange = (key: string) => (value: string) => {
    setPublication({ ...originalPublication, [key]: value });
  };

  return (
    <form className="p-2 flex flex-col space-y-6">
      {Publication.ATTRIBUTES.map((attribute) => (
        <PublicationInput
          label={Publication.ATTRIBUTE_LABELS[attribute]}
          publicationId={publicationId}
          attribute={attribute}
          value={publication[attribute]}
          onChange={handleChange(attribute)}
          error=""
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
        <Button variant="primary" width="fixed" type="submit" label="Submit" />
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
              publicationId={publicationId as number}
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
