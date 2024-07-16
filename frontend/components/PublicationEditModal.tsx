import { useRouter } from "next/router";
import { Publication, PublicationId } from "modules/publication";
import { Article } from "./Article";
import { Modal, useURLQueryModal } from "./Modal";
import Button from "./Button";
import DataInput from "./DataInput";

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
  publication,
  onClose,
}: PublicationEditFormProps) => {
  return (
    <form className="p-2 flex flex-col gap-1">
      {Publication.ATTRIBUTES.map((attrName) => (
        <div key={attrName}>
          <DataInput
            rowId={publicationId}
            colId={attrName}
            value={publication[attrName]}
            error=""
          />
        </div>
      ))}
      <div className="p-2 flex flex-row justify-between">
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
