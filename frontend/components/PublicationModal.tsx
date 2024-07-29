import { Publication, PublicationKey } from "modules/publication";
import { User } from "modules/users";
import Link from "next/link";
import { FC } from "react";
import { z } from "zod";
import { Article } from "./Article";
import { Modal, useURLQueryModal } from "./Modal";
import { usePublicationEditModal } from "./PublicationEditModal";
import Tooltip from "./Tooltip";
import Button from "./Button";

const PUBLICATION_MODAL_KEY = "publication";
const usePublicationModal = () => useURLQueryModal(PUBLICATION_MODAL_KEY);

const Param = z.string().regex(/^\d+$/).transform(Number).optional();
type Param = z.infer<typeof Param>;
const { useIsAuthenticated } = User;
const { usePublication } = Publication.STORE;

const Searchable: FC<{ label: string; value?: string }> = ({
  value,
  label,
}) => {
  const { close } = usePublicationModal();
  return (
    <Link
      href={`/?search=${value || label}`}
      className="anchor"
      onClick={close}
    >
      {label}
    </Link>
  );
};

const SearchableList: FC<{ items: { label: string; value?: string }[] }> = ({
  items,
}) => (
  <ul className="contents">
    {items.map((item, index) => (
      <li key={item.value} className="contents">
        {index != 0 && index === items.length - 1 && " and "}
        <Searchable {...item} />
        {index < items.length - 2 && ", "}
        {index === items.length - 1 && " "}
      </li>
    ))}
  </ul>
);

const PublicationHeading: FC<{ publication: Publication }> = ({
  publication,
}) => (
  <div className="flex flex-col w-full text-2xl font-normal sm:gap-2 sm:items-center sm:flex-row">
    <Tooltip info message="Translation's title">
      <span className="w-full truncate sm:w-min whitespace-nowrap">
        {publication.title}
      </span>
    </Tooltip>
    <Tooltip info message="Who translated this publication">
      <span className="text-lg font-light tracking-tighter text-indigo-500 sm:text-xl">
        ({publication.authors})
      </span>
    </Tooltip>
  </div>
);

const PublicationDescription: FC<{ publication: Publication }> = ({
  publication: p,
}) => {
  function getSearchableItems(p: Publication, key: PublicationKey) {
    return p[key]
      .split(",")
      .map((id) => id.trim())
      .map((id) => ({
        id,
        label: Publication.describeValue(id, key),
      }));
  }

  return (
    <p>
      <Searchable label={p.title} /> is a translation of{" "}
      <Searchable label={p.originalTitle} />, by{" "}
      <SearchableList items={getSearchableItems(p, "originalAuthors")} />. It
      was written by <SearchableList items={getSearchableItems(p, "authors")} />{" "}
      and published in{" "}
      <SearchableList items={getSearchableItems(p, "countries")} />
      in {p.year} by{" "}
      <SearchableList items={getSearchableItems(p, "publishers")} />.
    </p>
  );
};

const PublicationModal: FC = () => {
  const { value, ...modal } = usePublicationModal();
  const editModal = usePublicationEditModal();

  const publicationId = Param.parse(value);

  const publication = usePublication(publicationId);

  const isAuthenticated = useIsAuthenticated();

  const handleEdit = () => {
    editModal.open();
  };

  return (
    <Modal isOpen={modal.isOpen} onClose={modal.close}>
      {publication && (
        <Article
          heading={<PublicationHeading publication={publication} />}
          content={
            <>
              <PublicationDescription publication={publication} />
              {isAuthenticated && (
                <div className="flex flex-row justify-center m-4">
                  <Button onClick={handleEdit} label="Edit" width="fixed" />
                </div>
              )}
            </>
          }
        />
      )}
    </Modal>
  );
};

export { PUBLICATION_MODAL_KEY, PublicationModal, usePublicationModal };
