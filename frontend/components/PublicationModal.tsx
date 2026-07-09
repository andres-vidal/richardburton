"use client";

import {
  Publication,
  PublicationKey,
  usePublication,
} from "modules/publication";
import Link from "next/link";
import { FC } from "react";
import { z } from "zod";
import { Article } from "./Article";
import { Modal, useURLQueryModal } from "./Modal";
import Tooltip from "./Tooltip";

const PUBLICATION_MODAL_KEY = "publication";

const Param = z.string().regex(/^\d+$/).transform(Number).optional();
type Param = z.infer<typeof Param>;

const Searchable: FC<{ label: string; value?: string }> = ({
  value,
  label,
}) => {
  const { close } = useURLQueryModal(PUBLICATION_MODAL_KEY);
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
    <Tooltip variant="info" message="Translation's title">
      <span className="w-full truncate sm:w-min whitespace-nowrap">
        {publication.title}
      </span>
    </Tooltip>
    <Tooltip variant="info" message="Who translated this publication">
      <span className="text-lg font-light tracking-tighter text-indigo-500 sm:text-xl">
        ({publication.authors})
      </span>
    </Tooltip>
  </div>
);

const PublicationDescription: FC<{ publication: Publication }> = ({
  publication: p,
}) => {
  // `value` (not `id`): it's the field SearchableList keys on and Searchable
  // searches by. Naming it `id` left `value` undefined — a duplicate-key warning
  // and links that searched the human label (e.g. "United States of America")
  // instead of the raw value ("US").
  function getSearchableItems(p: Publication, key: PublicationKey) {
    return p[key]
      .split(",")
      .map((value) => value.trim())
      .map((value) => ({
        value,
        label: Publication.describeValue(value, key),
      }));
  }

  // A <div>, not a <p>: SearchableList renders a <ul>, which is invalid (and a
  // hydration error) nested inside a paragraph.
  return (
    <div>
      <Searchable label={p.title} /> is a translation of{" "}
      <Searchable label={p.originalTitle} />, by{" "}
      <SearchableList items={getSearchableItems(p, "originalAuthors")} />. It
      was written by <SearchableList items={getSearchableItems(p, "authors")} />{" "}
      and published in{" "}
      <SearchableList items={getSearchableItems(p, "countries")} />
      in {p.year} by{" "}
      <SearchableList items={getSearchableItems(p, "publishers")} />.
    </div>
  );
};

const PublicationModal: FC = () => {
  const { value, ...modal } = useURLQueryModal(PUBLICATION_MODAL_KEY);

  const publicationId = Param.parse(value);

  const publication = usePublication(publicationId);

  return (
    <Modal
      isOpen={modal.isOpen}
      onClose={modal.close}
      label="Publication details"
    >
      {publication && (
        <Article
          heading={<PublicationHeading publication={publication} />}
          content={<PublicationDescription publication={publication} />}
        />
      )}
    </Modal>
  );
};

export { PUBLICATION_MODAL_KEY, PublicationModal };
